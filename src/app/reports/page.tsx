import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import { Job } from '@/types'
export const dynamic = 'force-dynamic'

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string,string>> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')
  const today = new Date().toISOString().split('T')[0]
  const { from = today, to = today, q = '' } = await searchParams

  let query = supabaseAdmin.from('jobs').select('*, customer:customers(name), technician:technicians(name)').gte('scheduled_date',from).lte('scheduled_date',to).order('scheduled_date')
  if (q) query = query.or(`title.ilike.%${q}%,address.ilike.%${q}%`)

  const { data: jobs } = await query
  const total=jobs?.length||0
  const completed=jobs?.filter(j=>j.status==='completed').length||0
  const overdue=jobs?.filter(j=>j.status==='overdue').length||0
  const rate=total>0?Math.round(completed/total*100):0

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">📈 รายงาน</h1>
            <p className="page-subtitle">สรุปผลการดำเนินงาน</p>
          </div>
        </div>

        <form method="GET" className="card" style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end',marginBottom:20,padding:16}}>
          <div style={{ flex: '1 1 200px', minWidth: 180 }}>
            <label className="label">ค้นหาชื่องานหรือที่อยู่</label>
            <input type="text" name="q" defaultValue={q} placeholder="ค้นหา..." className="input" />
          </div>
          <div>
            <label className="label">จากวันที่</label>
            <input type="date" name="from" defaultValue={from} className="input" style={{width:'auto'}}/>
          </div>
          <div>
            <label className="label">ถึงวันที่</label>
            <input type="date" name="to" defaultValue={to} className="input" style={{width:'auto'}}/>
          </div>
          <button type="submit" className="btn btn-primary">🔍 ค้นหา</button>
          {(q || from !== today || to !== today) && (
            <a href="/reports" className="btn btn-ghost">ล้างตัวกรอง</a>
          )}
        </form>

        <div className="stat-grid">
          {[
            {label:'งานทั้งหมด',value:total,icon:'📋',color:'var(--blue)',bg:'var(--blue-lt)'},
            {label:'เสร็จแล้ว',value:completed,icon:'✅',color:'var(--green)',bg:'var(--green-lt)'},
            {label:'งานค้าง',value:overdue,icon:'⚠️',color:'var(--red)',bg:'var(--red-lt)'},
            {label:'สำเร็จ %',value:`${rate}%`,icon:'📊',color:'var(--purple)',bg:'var(--purple-lt)'},
          ].map(s=>(
            <div key={s.label} className="stat-card">
              <div style={{fontSize:22,background:s.bg,borderRadius:8,padding:'5px 8px',display:'inline-block',marginBottom:8}}>{s.icon}</div>
              <div className="stat-value" style={{color:s.color}}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>วันที่</th>
                <th>งาน</th>
                <th className="hide-mobile">ลูกค้า</th>
                <th className="hide-mobile">ช่าง</th>
                <th>สถานะ</th>
                <th className="hide-mobile">เหตุผล</th>
              </tr></thead>
              <tbody>
                {(jobs as unknown as Job[]||[]).map((job)=>(
                  <tr key={job.id}>
                    <td className="text-small text-muted">{job.scheduled_date}</td>
                    <td style={{fontWeight:600,fontSize:13}}><a href={`/jobs/${job.id}`} style={{color:'var(--text)'}}>{job.title}</a></td>
                    <td className="hide-mobile text-small text-muted">{(job as unknown as {customer:{name:string}}).customer?.name}</td>
                    <td className="hide-mobile text-small text-muted">{(job as unknown as {technician:{name:string}}).technician?.name||'-'}</td>
                    <td><StatusBadge status={job.status}/></td>
                    <td className="hide-mobile text-xs text-muted">{job.failure_reason||'-'}</td>
                  </tr>
                ))}
                {!total&&<tr><td colSpan={6} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>ไม่มีข้อมูลในช่วงที่เลือก</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
