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

  const { role: roleFilter = '', q = '' } = await searchParams

  // ── ดึงทุกแหล่งพร้อมกัน ──────────────────────────────────────────────────
  const [appRes, sessRes, techRes, custRes] = await Promise.all([
    supabaseAdmin.from('app_users').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('user_sessions').select('*').order('updated_at', { ascending: false }),
    supabaseAdmin.from('technicians').select('id,name,phone,line_user_id,status').eq('status','active').order('name'),
    supabaseAdmin.from('customers').select('id,name,phone,line_user_id').order('name'),
  ])

  const appUsers   = appRes.data  || []
  const sessions   = sessRes.data || []
  const technicians = techRes.data || []
  const customers  = custRes.data  || []

  // รวม LINE IDs ที่มีใน app_users แล้ว (ไม่ต้องแสดงซ้ำ)
  const appLineIds = new Set(appUsers.map(u => u.line_user_id).filter(Boolean))

  // user_sessions ที่ยังไม่อยู่ใน app_users
  const sessionUsers = sessions
    .filter(s => !appLineIds.has(s.line_user_id))
    .map(s => ({
      id: `sess_${s.id}`, _source: 'session' as const,
      display_name: s.display_name || 'ไม่ระบุ',
      picture_url: s.picture_url,
      role: s.role || 'customer',
      status: 'active',
      line_user_id: s.line_user_id,
      phone: null, email: null, notes: null,
      created_at: s.created_at, last_login_at: s.updated_at,
    }))

  // technicians ที่ไม่มีใน app_users และไม่มีใน user_sessions
  const sessLineIds = new Set(sessions.map(s => s.line_user_id).filter(Boolean))
  const techUsers = technicians
    .filter(t => !t.line_user_id || (!appLineIds.has(t.line_user_id) && !sessLineIds.has(t.line_user_id)))
    .map(t => ({
      id: `tech_${t.id}`, _source: 'tech' as const, ref_id: t.id,
      display_name: t.name, picture_url: null,
      role: 'technician', status: 'active',
      line_user_id: t.line_user_id || null,
      phone: t.phone, email: null, notes: null,
      created_at: null, last_login_at: null,
    }))

  // customers ที่ไม่มีในแหล่งอื่น
  const custUsers = customers
    .filter(c => !c.line_user_id || (!appLineIds.has(c.line_user_id) && !sessLineIds.has(c.line_user_id)))
    .map(c => ({
      id: `cust_${c.id}`, _source: 'cust' as const, ref_id: c.id,
      display_name: c.name, picture_url: null,
      role: 'customer', status: 'active',
      line_user_id: c.line_user_id || null,
      phone: c.phone, email: null, notes: null,
      created_at: null, last_login_at: null,
    }))

  // รวมทุกแหล่ง
  let allUsers = [
    ...appUsers.map(u => ({ ...u, _source: 'app' as const })),
    ...sessionUsers,
    ...techUsers,
    ...custUsers,
  ]

  // Filter
  if (roleFilter) allUsers = allUsers.filter(u => u.role === roleFilter)
  if (q) allUsers = allUsers.filter(u =>
    u.display_name?.toLowerCase().includes(q.toLowerCase()) ||
    (u.phone && u.phone.includes(q))
  )

  // ดึง "ชื่อเรียกที่ตั้งเอง" (ตั้งไว้ที่ Settings → คนที่เคยทัก LINE OA เข้ามา) มาโชว์คู่กับชื่อด้วย
  // ใช้ field แยกจาก notes เดิม (notes เดิมเป็นโน้ตของ app_users ที่แก้ไขได้ในหน้านี้อยู่แล้ว คนละเรื่องกัน)
  const allLineIds = allUsers.map(u => u.line_user_id).filter(Boolean) as string[]
  if (allLineIds.length > 0) {
    const { data: lineNotes } = await supabaseAdmin.from('line_seen_contacts').select('line_id, note').in('line_id', allLineIds)
    const lineNoteMap = Object.fromEntries((lineNotes || []).filter(n => n.note).map(n => [n.line_id, n.note]))
    allUsers = allUsers.map(u => ({ ...u, line_note: u.line_user_id ? lineNoteMap[u.line_user_id] || null : null }))
  }

  // Stats จากทุกแหล่ง (ไม่ซ้ำกัน)
  const stats = {
    total: allUsers.length,
    admin: allUsers.filter(u => u.role === 'admin').length,
    technician: allUsers.filter(u => u.role === 'technician').length,
    customer: allUsers.filter(u => u.role === 'customer').length,
    inactive: appUsers.filter(u => u.status !== 'active').length,
  }

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">👥 จัดการผู้ใช้งาน</h1>
            <p className="page-subtitle">รวมทุกแหล่ง: เพิ่มมือ · LINE Login · ช่าง · ลูกค้า</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <InviteButton />
            <a href="/admin/users/new" className="btn btn-primary">+ เพิ่มผู้ใช้</a>
          </div>
        </div>

        {/* Stats */}
        <div className="stat-grid">
          {[
            { label:'ผู้ใช้ทั้งหมด', value:stats.total,      icon:'👥', color:'var(--blue)',   bg:'var(--blue-lt)' },
            { label:'Admin',         value:stats.admin,      icon:'👑', color:'var(--purple)', bg:'var(--purple-lt)' },
            { label:'ช่าง',          value:stats.technician, icon:'👷', color:'var(--amber)',  bg:'var(--amber-lt)' },
            { label:'ลูกค้า',        value:stats.customer,   icon:'👤', color:'var(--brand)',  bg:'var(--brand-lt)' },
            { label:'ไม่ Active',    value:stats.inactive,   icon:'⏸',  color:'var(--red)',    bg:'var(--red-lt)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize:20, background:s.bg, borderRadius:8, padding:'4px 7px', display:'inline-block', marginBottom:6 }}>{s.icon}</div>
              <div className="stat-value" style={{ color:s.color, fontSize:22 }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:8, paddingBottom:4 }}>
          {[
            { key:'',           label:'ทั้งหมด' },
            { key:'admin',      label:'👑 Admin' },
            { key:'technician', label:'👷 ช่าง' },
            { key:'customer',   label:'👤 ลูกค้า' },
            { key:'viewer',     label:'👁 Viewer' },
          ].map(t => (
            <a key={t.key} href={`/admin/users?role=${t.key}${q?`&q=${q}`:''}`}
              style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, whiteSpace:'nowrap',
                background: roleFilter===t.key ? 'var(--dark)' : 'var(--white)',
                color: roleFilter===t.key ? '#fff' : 'var(--text-muted)', boxShadow:'var(--shadow-sm)' }}>
              {t.label}
            </a>
          ))}
        </div>

        <SearchBar action="/admin/users" placeholder="ค้นหาชื่อหรือเบอร์โทร..." defaultValue={q}
          extraParams={{ role: roleFilter }} />
        <div style={{ marginBottom:16 }} />

        <UserTable users={allUsers as never[]} currentAdminLineId={session.line_user_id} />
      </div>
    </AppLayout>
  )
}
