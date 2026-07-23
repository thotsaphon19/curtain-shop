import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import PeriodSelector, { getPeriodDates } from '@/components/ui/PeriodSelector'
import { Job } from '@/types'
export const dynamic = 'force-dynamic'

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string,string>> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const sp = await searchParams
  const period = sp.period || 'month'
  const q = sp.q || ''
  const { from, to, label } = getPeriodDates(period, sp.from, sp.to)

  const [jobsRes, invoicesRes] = await Promise.all([
    supabaseAdmin.from('jobs')
      .select('*, customer:customers(name), technician:technicians(name)')
      .gte('scheduled_date', from).lte('scheduled_date', to)
      .order('scheduled_date'),
    supabaseAdmin.from('invoices')
      .select('total,paid_amount,status')
      .gte('created_at', from).lte('created_at', `${to}T23:59:59`),
  ])

  let jobs = (jobsRes.data || []) as unknown as Job[]
  if (q) jobs = jobs.filter(j => j.title?.toLowerCase().includes(q.toLowerCase()) || j.address?.toLowerCase().includes(q.toLowerCase()))

  const invoices = invoicesRes.data || []
  const total = jobs.length
  const completed = jobs.filter(j => j.status === 'completed').length
  const inProgress = jobs.filter(j => j.status === 'in_progress').length
  const pending = jobs.filter(j => j.status === 'pending').length
  const overdue = jobs.filter(j => j.status === 'overdue').length
  const rate = total > 0 ? Math.round(completed / total * 100) : 0
  const revenue = invoices.filter(i => i.status === 'paid').reduce((s,i) => s+(i.total||0), 0)
  const outstanding = invoices.filter(i => i.status !== 'paid').reduce((s,i) => s+((i.total||0)-(i.paid_amount||0)), 0)

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">📈 รายงาน</h1>
            <p className="page-subtitle">สรุปผลการดำเนินงาน — {label}</p>
          </div>
        </div>

        <PeriodSelector action="/reports" currentPeriod={period} currentFrom={from} currentTo={to}
          showSearch searchValue={q} />

        {/* Stats */}
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          {[
            { label:'งานทั้งหมด',  value:total,     icon:'📋', color:'var(--blue)',   bg:'var(--blue-lt)' },
            { label:'เสร็จแล้ว',   value:completed, icon:'✅', color:'var(--green)',  bg:'var(--green-lt)' },
            { label:'กำลังทำ',     value:inProgress,icon:'🔧', color:'var(--purple)', bg:'var(--purple-lt)' },
            { label:'รอมอบหมาย',  value:pending,   icon:'⏳', color:'var(--amber)',  bg:'var(--amber-lt)' },
            { label:'เกินกำหนด',  value:overdue,   icon:'⚠️', color:'var(--red)',    bg:'var(--red-lt)' },
            { label:'สำเร็จ %',    value:`${rate}%`,icon:'📊', color:'var(--brand)',  bg:'var(--brand-lt)' },
            { label:'รายได้รวม',  value:`฿${revenue.toLocaleString()}`, icon:'💰', color:'var(--green)', bg:'var(--green-lt)' },
            { label:'ค้างชำระ',   value:`฿${outstanding.toLocaleString()}`, icon:'💳', color:'var(--red)', bg:'var(--red-lt)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize:20, background:s.bg, borderRadius:8, padding:'4px 7px', display:'inline-block', marginBottom:6 }}>{s.icon}</div>
              <div className="stat-value" style={{ color:s.color, fontSize:20 }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Job table */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th><th>งาน</th>
                  <th className="hide-mobile">ลูกค้า</th>
                  <th className="hide-mobile">ช่าง</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id}>
                    <td className="text-small text-muted">{job.scheduled_date}</td>
                    <td style={{ fontWeight:600, fontSize:13 }}>
                      <a href={`/jobs/${job.id}`} style={{ color:'var(--text)' }}>{job.title}</a>
                    </td>
                    <td className="hide-mobile text-small text-muted">{(job as unknown as {customer:{name:string}}).customer?.name || '-'}</td>
                    <td className="hide-mobile text-small text-muted">{(job as unknown as {technician:{name:string}}).technician?.name || '-'}</td>
                    <td><StatusBadge status={job.status} /></td>
                  </tr>
                ))}
                {!total && <tr><td colSpan={5} style={{ textAlign:'center', padding:24, color:'var(--text-muted)' }}>ไม่มีข้อมูลในช่วงที่เลือก</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
