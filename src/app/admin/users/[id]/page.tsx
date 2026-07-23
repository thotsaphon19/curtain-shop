import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import UserPermissions from './UserPermissions'
export const dynamic = 'force-dynamic'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const { data: user } = await supabaseAdmin
    .from('app_users').select('*, invited_by_user:invited_by(display_name)').eq('id', id).single()

  if (!user) redirect('/admin/users')

  const { data: logs } = await supabaseAdmin
    .from('user_activity_logs').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(20)

  // If technician, get their job stats
  let techStats: { total: number; completed: number; pending: number } | null = null
  if (user.role === 'technician' && user.ref_id) {
    const { data: tjobs } = await supabaseAdmin.from('jobs').select('status').eq('technician_id', user.ref_id)
    if (tjobs) {
      techStats = {
        total: tjobs.length,
        completed: tjobs.filter(j => j.status === 'completed').length,
        pending: tjobs.filter(j => ['assigned', 'heading', 'in_progress'].includes(j.status)).length,
      }
    }
  }

  const ROLE_ICON: Record<string, string> = { admin: '👑', technician: '👷', customer: '👤', viewer: '👁' }
  const STATUS_CLS: Record<string, string> = { active: 'badge-green', inactive: 'badge-gray', suspended: 'badge-red' }
  const ACTION_ICON: Record<string, string> = { login: '🔑', create_user: '➕', update_user: '✏️', assign_job: '📋', create_invoice: '💳', update_status: '🔄' }

  return (
    <AppLayout user={session}>
      <div style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <a href="/admin/users" style={{ color: 'var(--text-muted)', fontSize: 14 }}>← ผู้ใช้ทั้งหมด</a>
        </div>

        {/* Profile header */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {user.avatar_url
              ? <img src={user.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--brand-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                  {ROLE_ICON[user.role]}
                </div>
            }
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--dark)', margin: 0 }}>{user.display_name}</h1>
                <span className={`badge badge-${user.role === 'admin' ? 'purple' : user.role === 'technician' ? 'amber' : 'brand'}`}>
                  {ROLE_ICON[user.role]} {user.role}
                </span>
                <span className={`badge ${STATUS_CLS[user.status] || 'badge-gray'}`}>{user.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)' }}>
                {user.phone && <span>📱 {user.phone}</span>}
                {user.email && <span>✉️ {user.email}</span>}
                <span style={{ color: user.line_user_id ? 'var(--brand)' : 'var(--text-muted)' }}>
                  {user.line_user_id ? '💬 ผูก LINE แล้ว' : '⬜ ยังไม่ผูก LINE'}
                </span>
              </div>
              {user.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{user.notes}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                สมัครเมื่อ {new Date(user.created_at).toLocaleDateString('th-TH')}
                {user.last_login_at && ` · เข้าระบบล่าสุด ${new Date(user.last_login_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                {(user as unknown as { invited_by_user: { display_name: string } }).invited_by_user && ` · เชิญโดย ${(user as unknown as { invited_by_user: { display_name: string } }).invited_by_user.display_name}`}
              </div>
            </div>
          </div>
        </div>

        {/* Technician job stats */}
        {techStats && (
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            {[
              { label: 'งานทั้งหมด', value: techStats.total, color: 'var(--blue)', bg: 'var(--blue-lt)' },
              { label: 'เสร็จแล้ว', value: techStats.completed, color: 'var(--green)', bg: 'var(--green-lt)' },
              { label: 'กำลังทำ', value: techStats.pending, color: 'var(--amber)', bg: 'var(--amber-lt)' },
              { label: 'อัตราสำเร็จ', value: techStats.total > 0 ? `${Math.round(techStats.completed / techStats.total * 100)}%` : '—', color: 'var(--purple)', bg: 'var(--purple-lt)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Permissions */}
        <UserPermissions userId={id} role={user.role} permissions={user.permissions || {}} />

        {/* Activity log */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-header">
            <span className="section-title">📝 กิจกรรม</span>
          </div>
          {!logs?.length ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>ยังไม่มีกิจกรรม</div>
          ) : (
            <div>
              {logs.map(log => (
                <div key={log.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f5f5f5', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20 }}>{ACTION_ICON[log.action] || '📝'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{log.action.replace(/_/g, ' ')}</div>
                    {log.target_type && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.target_type}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
