import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import SearchBar from '@/components/ui/SearchBar'
import DeleteJobButton from './DeleteJobButton'
import { Job } from '@/types'
export const dynamic = 'force-dynamic'

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string,string>> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const { status = '', q = '', from = '', to = '' } = await searchParams

  let query = supabaseAdmin.from('jobs').select('*, customer:customers(name,phone), technician:technicians(name)').order('scheduled_date',{ascending:false}).order('scheduled_time').limit(200)
  if (status) query = query.eq('status', status)
  if (from) query = query.gte('scheduled_date', from)
  if (to) query = query.lte('scheduled_date', to)
  // ค้นหาชื่องานหรือที่อยู่ — ฝั่งลูกค้า/ช่าง filter เพิ่มเติมที่ client เพราะ join ตรงๆ ใน .or() ทำกับ Supabase ไม่ได้
  if (q) query = query.or(`title.ilike.%${q}%,address.ilike.%${q}%`)

  const { data: jobs } = await query

  const STATUS_TABS = [
    { key:'', label:'ทั้งหมด' },
    { key:'pending', label:'รอมอบหมาย' },
    { key:'assigned', label:'มอบหมายแล้ว' },
    { key:'in_progress', label:'กำลังทำ' },
    { key:'completed', label:'เสร็จแล้ว' },
    { key:'overdue', label:'เกินกำหนด' },
  ]

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">🔧 จัดการงาน</h1>
            <p className="page-subtitle">งานทั้งหมด {jobs?.length||0} รายการ</p>
          </div>
          <a href="/jobs/new" className="btn btn-primary">+ สร้างงานใหม่</a>
        </div>

        {/* Status filter tabs */}
        <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:16,paddingBottom:4}}>
          {STATUS_TABS.map(t => (
            <a key={t.key} href={`/jobs?status=${t.key}&q=${q}&from=${from}&to=${to}`} style={{
              padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,whiteSpace:'nowrap',
              background: status===t.key ? 'var(--dark)' : 'var(--white)',
              color: status===t.key ? '#fff' : 'var(--text-muted)',
              boxShadow:'var(--shadow-sm)',
            }}>{t.label}</a>
          ))}
        </div>

        <SearchBar
          action="/jobs" placeholder="ค้นหาชื่องานหรือที่อยู่..."
          defaultValue={q} showDateRange defaultFrom={from} defaultTo={to}
          extraParams={{ status }}
        />

        <div className="card" style={{ marginTop: 16 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>งาน / ที่อยู่</th>
                  <th className="hide-mobile">ลูกค้า</th>
                  <th className="hide-mobile">ช่าง</th>
                  <th>วันที่</th>
                  <th>สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(jobs as unknown as Job[]||[]).map(job => (
                  <tr key={job.id}>
                    <td>
                      <a href={`/jobs/${job.id}`} style={{fontWeight:700,color:'var(--text)',display:'block'}}>{job.title}</a>
                      <div className="text-xs text-muted mt-4 truncate" style={{maxWidth:200}}>{job.address}</div>
                    </td>
                    <td className="hide-mobile">
                      <div style={{fontWeight:600,fontSize:13}}>{(job as unknown as {customer:{name:string}}).customer?.name||'-'}</div>
                      <div className="text-xs text-muted">{(job as unknown as {customer:{phone:string}}).customer?.phone}</div>
                    </td>
                    <td className="hide-mobile text-muted text-small">{(job as unknown as {technician:{name:string}}).technician?.name||<span style={{color:'#ccc'}}>ยังไม่มอบหมาย</span>}</td>
                    <td>
                      <div className="text-small" style={{fontWeight:600}}>{job.scheduled_date}</div>
                      <div className="text-xs text-muted">{job.scheduled_time?.slice(0,5)}</div>
                    </td>
                    <td><StatusBadge status={job.status}/></td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'flex-end' }}>
                        <a href={`/jobs/${job.id}`} style={{color:'var(--brand)',fontSize:12,fontWeight:700}}>แก้ไข →</a>
                        <DeleteJobButton jobId={job.id} jobTitle={job.title} />
                      </div>
                    </td>
                  </tr>
                ))}
                {!jobs?.length && <tr><td colSpan={6} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>{q||from||to ? 'ไม่พบงานที่ตรงกับการค้นหา' : 'ไม่มีงาน'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
