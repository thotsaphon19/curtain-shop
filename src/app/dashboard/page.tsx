import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import { Job } from '@/types'
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const [todayRes, overdueRes, unpaidRes, recentRes] = await Promise.all([
    supabaseAdmin.from('jobs').select('status').eq('scheduled_date', today),
    supabaseAdmin.from('jobs').select('id').eq('status', 'overdue'),
    supabaseAdmin.from('invoices').select('total,paid_amount').in('status',['unpaid','partial','overdue']),
    supabaseAdmin.from('jobs').select('*, customer:customers(name), technician:technicians(name)').order('created_at',{ascending:false}).limit(8),
  ])
  const todayJobs = todayRes.data || []
  const totalOwed = (unpaidRes.data||[]).reduce((s,i)=>s+((i.total||0)-(i.paid_amount||0)),0)

  const stats = [
    { label:'งานวันนี้',    value:todayJobs.length,                                              icon:'🔧', color:'var(--blue)',   bg:'var(--blue-lt)' },
    { label:'เสร็จแล้ว',   value:todayJobs.filter(j=>j.status==='completed').length,             icon:'✅', color:'var(--green)',  bg:'var(--green-lt)' },
    { label:'งานค้าง',     value:overdueRes.data?.length||0,                                     icon:'⚠️', color:'var(--red)',    bg:'var(--red-lt)' },
    { label:'ค้างชำระ',    value:`฿${totalOwed.toLocaleString()}`,                               icon:'💳', color:'var(--amber)',  bg:'var(--amber-lt)' },
  ]

  const quickActions = [
    { href:'/jobs/new',       label:'สร้างงานใหม่',   icon:'➕', border:'var(--brand)' },
    { href:'/quotations/new', label:'ใบเสนอราคา',     icon:'📋', border:'var(--blue)' },
    { href:'/invoices/new',   label:'สร้าง Invoice',  icon:'💳', border:'var(--amber)' },
    { href:'/map',            label:'ดูแผนที่วันนี้', icon:'🗺️', border:'var(--purple)' },
  ]

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">สวัสดี คุณ{session.display_name} 👋</h1>
            <p className="page-subtitle">
              {new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="stat-grid">
          {stats.map(s => (
            <div key={s.label} className="stat-card">
              <div style={{fontSize:22,background:s.bg,borderRadius:8,padding:'5px 8px',display:'inline-block',marginBottom:8}}>{s.icon}</div>
              <div className="stat-value" style={{color:s.color}}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:20}}>
          {quickActions.map(a => (
            <a key={a.href} href={a.href} style={{
              display:'flex',alignItems:'center',gap:8,padding:'11px 14px',
              background:'var(--white)',borderRadius:10,
              boxShadow:'var(--shadow-sm)',fontWeight:700,fontSize:13,
              color:'var(--text)',borderLeft:`4px solid ${a.border}`,
            }}>
              <span style={{fontSize:16}}>{a.icon}</span>{a.label}
            </a>
          ))}
        </div>

        {/* Recent jobs */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">งานล่าสุด</span>
            <a href="/jobs" style={{fontSize:13,color:'var(--brand)',fontWeight:600}}>ดูทั้งหมด →</a>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>งาน</th>
                  <th className="hide-mobile">ลูกค้า</th>
                  <th className="hide-mobile">ช่าง</th>
                  <th>วันที่</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {(recentRes.data as unknown as Job[]||[]).map(job => (
                  <tr key={job.id}>
                    <td>
                      <a href={`/jobs/${job.id}`} style={{fontWeight:700,color:'var(--text)'}}>{job.title}</a>
                      <div className="text-xs text-muted show-mobile">{(job as unknown as {customer:{name:string}}).customer?.name}</div>
                    </td>
                    <td className="hide-mobile text-muted">{(job as unknown as {customer:{name:string}}).customer?.name||'-'}</td>
                    <td className="hide-mobile text-muted">{(job as unknown as {technician:{name:string}}).technician?.name||'-'}</td>
                    <td className="text-muted text-small">{job.scheduled_date}</td>
                    <td><StatusBadge status={job.status}/></td>
                  </tr>
                ))}
                {!recentRes.data?.length && (
                  <tr><td colSpan={5} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>ยังไม่มีงาน</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
