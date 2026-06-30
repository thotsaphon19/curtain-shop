import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import SearchBar from '@/components/ui/SearchBar'
import UserTable from './UserTable'
import InviteButton from './InviteButton'
export const dynamic = 'force-dynamic'

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const { role: roleFilter = '', status: statusFilter = 'active', q = '' } = await searchParams

  let q_ = supabaseAdmin
    .from('app_users')
    .select('*, invited_by_user:invited_by(display_name)')
    .order('created_at', { ascending: false })

  if (roleFilter)   q_ = q_.eq('role', roleFilter)
  if (statusFilter) q_ = q_.eq('status', statusFilter)
  if (q)            q_ = q_.or(`display_name.ilike.%${q}%,phone.ilike.%${q}%`)

  const { data: users } = await q_

  // Stats
  const { data: allUsers } = await supabaseAdmin.from('app_users').select('role, status')
  const stats = {
    total:      allUsers?.length || 0,
    admin:      allUsers?.filter(u => u.role === 'admin').length || 0,
    technician: allUsers?.filter(u => u.role === 'technician').length || 0,
    customer:   allUsers?.filter(u => u.role === 'customer').length || 0,
    inactive:   allUsers?.filter(u => u.status !== 'active').length || 0,
  }

  // Recent activity
  const { data: recentActivity } = await supabaseAdmin
    .from('user_activity_logs')
    .select('*, user:user_id(display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">👥 จัดการผู้ใช้งาน</h1>
            <p className="page-subtitle">Admin · ช่าง · ลูกค้า · Viewer</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <InviteButton />
            <a href="/admin/users/new" className="btn btn-primary">+ เพิ่มผู้ใช้</a>
          </div>
        </div>

        {/* Stats */}
        <div className="stat-grid">
          {[
            { label: 'ผู้ใช้ทั้งหมด', value: stats.total,      icon: '👥', color: 'var(--blue)',   bg: 'var(--blue-lt)' },
            { label: 'Admin',          value: stats.admin,      icon: '👑', color: 'var(--purple)', bg: 'var(--purple-lt)' },
            { label: 'ช่าง',           value: stats.technician, icon: '👷', color: 'var(--amber)',  bg: 'var(--amber-lt)' },
            { label: 'ลูกค้า',         value: stats.customer,   icon: '👤', color: 'var(--brand)',  bg: 'var(--brand-lt)' },
            { label: 'ไม่ Active',     value: stats.inactive,   icon: '⏸',  color: 'var(--red)',    bg: 'var(--red-lt)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize: 20, background: s.bg, borderRadius: 8, padding: '4px 7px', display: 'inline-block', marginBottom: 6 }}>{s.icon}</div>
              <div className="stat-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          {[
            { key: '', label: 'ทั้งหมด' },
            { key: 'admin', label: '👑 Admin' },
            { key: 'technician', label: '👷 ช่าง' },
            { key: 'customer', label: '👤 ลูกค้า' },
            { key: 'viewer', label: '👁 Viewer' },
          ].map(t => (
            <a key={t.key}
              href={`/admin/users?role=${t.key}&status=${statusFilter}`}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                whiteSpace: 'nowrap', background: roleFilter === t.key ? 'var(--dark)' : 'var(--white)',
                color: roleFilter === t.key ? '#fff' : 'var(--text-muted)',
                boxShadow: 'var(--shadow-sm)',
              }}>
              {t.label}
            </a>
          ))}
          <div style={{ flex: 1 }} />
          {['active', 'inactive', 'suspended'].map(s => (
            <a key={s}
              href={`/admin/users?role=${roleFilter}&status=${s}`}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                whiteSpace: 'nowrap',
                background: statusFilter === s ? 'var(--blue)' : 'var(--white)',
                color: statusFilter === s ? '#fff' : 'var(--text-muted)',
                boxShadow: 'var(--shadow-sm)',
              }}>
              {s === 'active' ? 'Active' : s === 'inactive' ? 'Inactive' : 'Suspended'}
            </a>
          ))}
        </div>

        {/* Search */}
        <SearchBar
          action="/admin/users" placeholder="ค้นหาชื่อหรือเบอร์โทร..." defaultValue={q}
          extraParams={{ role: roleFilter, status: statusFilter }}
        />
        <div style={{ marginBottom: 16 }} />

        {/* User table */}
        <UserTable users={users || []} currentAdminLineId={session.line_user_id} />

        {/* Activity log */}
        {recentActivity && recentActivity.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="section-header">
              <span className="section-title">📝 กิจกรรมล่าสุด</span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {recentActivity.map(log => (
                <div key={log.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f5f5f5', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 24 }}>
                    {log.action?.includes('login') ? '🔑' : log.action?.includes('create') ? '➕' : log.action?.includes('update') ? '✏️' : log.action?.includes('delete') ? '🗑' : '📝'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>
                      {(log as unknown as { user: { display_name: string } }).user?.display_name || 'ระบบ'} — {log.action}
                    </div>
                    {log.target_type && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.target_type}: {log.target_id?.slice(0, 8)}...</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
