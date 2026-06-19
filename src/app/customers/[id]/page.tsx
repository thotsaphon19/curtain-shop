import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import { Job } from '@/types'
import NotifyPanel from './NotifyPanel'
export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const [custRes, jobsRes, invoicesRes, groupRes] = await Promise.all([
    supabaseAdmin.from('customers').select('*').eq('id', id).single(),
    supabaseAdmin.from('jobs').select('*, technician:technicians(name)').eq('customer_id', id).order('scheduled_date', { ascending:false }).limit(10),
    supabaseAdmin.from('invoices').select('*').eq('customer_id', id).order('created_at', { ascending:false }).limit(10),
    supabaseAdmin.from('line_group_settings').select('*').eq('customer_id', id).maybeSingle(),
  ])

  const customer = custRes.data
  if (!customer) redirect('/customers')

  const jobs = jobsRes.data || []
  const invoices = invoicesRes.data || []
  const group = groupRes.data
  const unpaid = invoices.filter(i => ['unpaid','partial','overdue'].includes(i.status))
  const totalOwed = unpaid.reduce((s, i) => s + ((i.total||0)-(i.paid_amount||0)), 0)

  return (
    <AppLayout user={session}>
      <div>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <a href="/customers" style={{ color:'var(--text-muted)', fontSize:14, marginTop:4 }}>← ลูกค้า</a>
          <div style={{ flex:1 }}>
            <h1 style={{ fontSize:20, fontWeight:800, margin:'0 0 4px', color:'var(--dark)' }}>{customer.name}</h1>
            <p style={{ fontSize:13, color:'var(--text-muted)', margin:0 }}>{customer.phone} · {customer.address}</p>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <span className={`badge ${customer.line_user_id?'badge-brand':'badge-gray'}`}>{customer.line_user_id?'💬 LINE ผูกแล้ว':'⬜ ยังไม่ผูก'}</span>
            <span className={`badge ${group?'badge-blue':'badge-gray'}`}>{group?'👥 มี Group':'⬜ ไม่มี Group'}</span>
            {group?.khunthong_added && <span className="badge badge-amber">🏦 ขุนทอง</span>}
          </div>
        </div>

        {totalOwed > 0 && (
          <div className="alert alert-warning" style={{ marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:28 }}>💳</span>
            <div>
              <div style={{ fontWeight:800, fontSize:16 }}>฿{totalOwed.toLocaleString()}</div>
              <div style={{ fontSize:12 }}>ยอดค้างชำระ {unpaid.length} Invoice</div>
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.5fr) minmax(0,1fr)', gap:16, alignItems:'start' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Invoices */}
            <div className="card">
              <div className="section-header">
                <span className="section-title">💳 Invoice</span>
                <a href="/invoices/new" style={{ fontSize:12, color:'var(--brand)', fontWeight:600 }}>+ สร้าง</a>
              </div>
              {invoices.length === 0 ? (
                <div style={{ padding:'16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>ยังไม่มี Invoice</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Invoice</th><th>ยอด</th><th>คงเหลือ</th><th>สถานะ</th><th></th></tr></thead>
                    <tbody>
                      {invoices.map((inv, i) => {
                        const remain = (inv.total||0)-(inv.paid_amount||0)
                        const SC: Record<string,[string,string]> = {
                          unpaid:['รอชำระ','badge-red'], partial:['บางส่วน','badge-amber'],
                          paid:['ชำระแล้ว','badge-green'], overdue:['เกิน','badge-red']
                        }
                        const [sl, sc] = SC[inv.status] || SC.unpaid
                        return (
                          <tr key={inv.id} style={{ background:i%2?'#fafafa':'#fff' }}>
                            <td style={{ fontWeight:700, fontSize:13 }}><a href={`/invoices/${inv.id}`} style={{ color:'var(--dark)' }}>{inv.invoice_no}</a></td>
                            <td style={{ fontSize:13 }}>฿{(inv.total||0).toLocaleString()}</td>
                            <td style={{ fontWeight:remain>0?800:400, color:remain>0?'var(--red)':'var(--green)', fontSize:13 }}>{remain>0?`฿${remain.toLocaleString()}`:'-'}</td>
                            <td><span className={`badge ${sc}`}>{sl}</span></td>
                            <td><a href={`/invoices/${inv.id}`} style={{ color:'var(--brand)', fontSize:12, fontWeight:700 }}>ดู</a></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Jobs */}
            <div className="card">
              <div className="section-header">
                <span className="section-title">🔧 ประวัติงาน</span>
                <a href="/jobs/new" style={{ fontSize:12, color:'var(--brand)', fontWeight:600 }}>+ สร้าง</a>
              </div>
              {jobs.length === 0 ? (
                <div style={{ padding:'16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>ยังไม่มีงาน</div>
              ) : (
                <div style={{ padding:'4px 0' }}>
                  {(jobs as unknown as Job[]).map(job => (
                    <div key={job.id} style={{ padding:'10px 16px', borderBottom:'1px solid #f5f5f5', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <a href={`/jobs/${job.id}`} style={{ fontSize:14, fontWeight:700, color:'var(--dark)' }}>{job.title}</a>
                        <div className="text-xs text-muted" style={{ marginTop:2 }}>
                          {job.scheduled_date} · {(job as unknown as {technician:{name:string}}).technician?.name || 'ยังไม่มีช่าง'}
                        </div>
                      </div>
                      <StatusBadge status={job.status}/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notify Panel */}
          <NotifyPanel
            customerId={id} customerName={customer.name}
            customerLineId={customer.line_user_id}
            hasGroup={!!group} groupId={group?.group_id}
            groupName={group?.group_name} khunthongAdded={group?.khunthong_added||false}
            unpaidInvoices={unpaid.map(i=>({ id:i.id, invoice_no:i.invoice_no, remain:(i.total||0)-(i.paid_amount||0), status:i.status }))}
          />
        </div>
      </div>
    </AppLayout>
  )
}
