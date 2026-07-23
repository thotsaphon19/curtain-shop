import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import { Job } from '@/types'
import JobActions from './JobActions'
import EditHistory from './EditHistory'
import JobDocuments from './JobDocuments'
export const dynamic = 'force-dynamic'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const { data: job, error } = await supabaseAdmin
    .from('jobs').select('*, customer:customers(*), technician:technicians(*)')
    .eq('id', id).single()

  if (error || !job) {
    return (
      <AppLayout user={session}>
        <div className="alert alert-error">ไม่พบงาน ID: {id}</div>
      </AppLayout>
    )
  }

  const [{ data: technicians }, { data: editLogs }, { data: jobDocs }] = await Promise.all([
    supabaseAdmin.from('technicians').select('id,name,line_user_id').eq('status','active').order('name'),
    supabaseAdmin.from('job_edit_logs').select('*').eq('job_id', id).order('created_at', { ascending: false }),
    supabaseAdmin.from('job_documents').select('*').eq('job_id', id).order('created_at'),
  ])

  type JoinedJob = Job & {
    customer: { name:string; phone:string; address:string; line_user_id?:string }
    technician?: { name:string; phone:string }
  }
  const j = job as unknown as JoinedJob

  return (
    <AppLayout user={session}>
      <div style={{ maxWidth:800 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <a href="/jobs" style={{ color:'var(--text-muted)', fontSize:14 }}>← งานทั้งหมด</a>
          <h1 style={{ fontSize:20, fontWeight:800, margin:0, color:'var(--dark)', flex:1 }}>{j.title}</h1>
          <StatusBadge status={j.status}/>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16 }}>
          {/* Job info */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--brand)', marginBottom:14 }}>ข้อมูลงาน</div>
            {[
              ['ชื่องาน', j.title],
              ['รายละเอียด', j.description || '-'],
              ['ที่อยู่', j.address],
              ['วันที่', j.scheduled_date],
              ['เวลา', j.scheduled_time?.slice(0,5)],
              ['ยอดทั้งหมด', j.amount ? `฿${j.amount.toLocaleString()} บาท` : '-'],
              ['ยอดมัดจำ', j.deposit_amount ? `฿${j.deposit_amount.toLocaleString()} บาท` : '-'],
              ['ยอดคงเหลือ', j.amount ? `฿${(j.amount + (j.vat_amount || 0) - (j.deposit_amount || 0)).toLocaleString()} บาท` : '-'],
              ...(j.vat_amount ? [['VAT', `฿${j.vat_amount.toLocaleString()} บาท`]] : []),
              ['เลขที่ Invoice', j.has_invoice_no && j.invoice_no ? j.invoice_no : 'ระบบสร้างอัตโนมัติตอนปิดงาน'],
              ['เลขบัญชี', j.bank_account || '-'],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', gap:10, marginBottom:8, fontSize:13 }}>
                <span style={{ color:'var(--text-muted)', minWidth:90 }}>{k}</span>
                <span style={{ color:'var(--text)', fontWeight:500 }}>{v}</span>
              </div>
            ))}
            {j.start_photo_url || j.end_photo_url ? (
              <div style={{ marginTop:12, display:'flex', gap:12, flexWrap:'wrap' }}>
                {j.start_photo_url && (
                  <div>
                    <div className="text-xs text-muted" style={{ marginBottom:4 }}>📷 รูปรับงาน</div>
                    <img src={j.start_photo_url} alt="start" style={{ width:120, height:90, objectFit:'cover', borderRadius:8 }}/>
                  </div>
                )}
                {j.end_photo_url && (
                  <div>
                    <div className="text-xs text-muted" style={{ marginBottom:4 }}>📷 รูปปิดงาน</div>
                    <img src={j.end_photo_url} alt="end" style={{ width:120, height:90, objectFit:'cover', borderRadius:8 }}/>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Customer info */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--blue)', marginBottom:14 }}>ข้อมูลลูกค้า</div>
            {[
              ['ชื่อ', j.customer?.name],
              ['โทร', j.customer?.phone],
              ['ที่อยู่', j.customer?.address],
              ['LINE', j.customer?.line_user_id ? '✅ ผูกแล้ว' : '⬜ ยังไม่ผูก'],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', gap:10, marginBottom:8, fontSize:13 }}>
                <span style={{ color:'var(--text-muted)', minWidth:70 }}>{k}</span>
                <span style={{ color:'var(--text)', fontWeight:500 }}>{v || '-'}</span>
              </div>
            ))}
            {j.technician && (
              <>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--amber)', marginTop:16, marginBottom:10 }}>ช่างที่รับผิดชอบ</div>
                <div style={{ display:'flex', gap:10, fontSize:13 }}>
                  <span style={{ color:'var(--text-muted)', minWidth:70 }}>ชื่อ</span>
                  <span style={{ fontWeight:700 }}>{j.technician.name}</span>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <JobActions job={j as unknown as Job} technicians={technicians || []}/>
        </div>

        <JobDocuments jobId={id} initialDocs={jobDocs || []} />
        <EditHistory logs={editLogs || []}/>
      </div>
    </AppLayout>
  )
}
