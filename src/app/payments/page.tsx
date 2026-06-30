import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import PaymentActions from './PaymentActions'
export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const [unpaidRes, configRes] = await Promise.all([
    supabaseAdmin.from('invoices').select('*, customer:customers(name,phone,line_user_id,id)').in('status',['unpaid','partial','overdue']).order('due_date',{ascending:true}),
    supabaseAdmin.from('payment_reminder_configs').select('*').order('days_after'),
  ])
  const invoices = unpaidRes.data||[]
  const configs = configRes.data||[]
  const totalOwed = invoices.reduce((s,i)=>s+((i.total||0)-(i.paid_amount||0)),0)

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">💰 การชำระเงิน</h1>
            <p className="page-subtitle">ติดตามยอดค้างชำระและตั้งค่าแจ้งเตือน</p>
          </div>
          <a href="/invoices/new" className="btn btn-primary">+ สร้าง Invoice</a>
        </div>

        <div className="stat-grid">
          {[
            {label:'รอชำระ',value:invoices.length,icon:'📋',color:'var(--red)',bg:'var(--red-lt)'},
            {label:'ยอดค้างรวม',value:`฿${totalOwed.toLocaleString()}`,icon:'💳',color:'var(--amber)',bg:'var(--amber-lt)'},
            {label:'เกินกำหนด',value:invoices.filter(i=>i.status==='overdue').length,icon:'⚠️',color:'var(--red)',bg:'var(--red-lt)'},
          ].map(s=>(
            <div key={s.label} className="stat-card">
              <div style={{fontSize:22,background:s.bg,borderRadius:8,padding:'5px 8px',display:'inline-block',marginBottom:8}}>{s.icon}</div>
              <div className="stat-value" style={{color:s.color}}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{marginBottom:20}}>
          <div className="section-header">
            <span className="section-title">Invoice ค้างชำระ</span>
          </div>
          {invoices.length===0 ? (
            <div style={{padding:'32px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>ไม่มียอดค้างชำระ 🎉</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Invoice</th>
                  <th>ลูกค้า</th>
                  <th>คงเหลือ</th>
                  <th className="hide-mobile">ครบกำหนด</th>
                  <th>สถานะ</th>
                  <th>Action</th>
                </tr></thead>
                <tbody>
                  {invoices.map((inv,i) => {
                    const remain=(inv.total||0)-(inv.paid_amount||0)
                    const isOverdue=inv.due_date&&new Date(inv.due_date)<new Date()
                    const cust=(inv as unknown as {customer:{name:string,phone:string,line_user_id?:string}}).customer
                    return (
                      <tr key={inv.id} style={{background:isOverdue?(i%2?'#FFF5F5':'#FFF8F8'):undefined}}>
                        <td><div style={{fontWeight:700,fontSize:13}}>{inv.invoice_no}</div></td>
                        <td>
                          <div style={{fontWeight:600,fontSize:13}}>{cust?.name}</div>
                          <div className="text-xs text-muted">{cust?.phone}</div>
                        </td>
                        <td><div style={{fontWeight:800,fontSize:14,color:'var(--red)'}}>฿{remain.toLocaleString()}</div></td>
                        <td className="hide-mobile">
                          <div className="text-small" style={{color:isOverdue?'var(--red)':'var(--text-soft)'}}>{inv.due_date||'-'}</div>
                          {isOverdue&&<div className="text-xs" style={{color:'var(--red)'}}>⚠️ เกิน</div>}
                        </td>
                        <td>
                          <span className={`badge ${inv.status==='overdue'?'badge-red':inv.status==='partial'?'badge-amber':'badge-gray'}`}>
                            {inv.status==='overdue'?'เกินกำหนด':inv.status==='partial'?'บางส่วน':'รอชำระ'}
                          </span>
                        </td>
                        <td>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                            <a href={`/invoices/${inv.id}`} className="btn btn-secondary" style={{padding:'4px 10px',fontSize:11}}>ดู</a>
                            {cust?.line_user_id && (
                              <PaymentActions invoiceId={inv.id} customerLineId={cust.line_user_id} invoiceNo={inv.invoice_no} amount={remain} customerName={cust.name}/>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Reminder config summary */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">⚙️ การแจ้งเตือนอัตโนมัติ</span>
            <a href="/payments/settings" style={{fontSize:13,color:'var(--brand)',fontWeight:600}}>แก้ไข</a>
          </div>
          <div style={{padding:'8px 0'}}>
            {configs.map(c=>(
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 18px',borderBottom:'1px solid #f5f5f5'}}>
                <span style={{fontSize:18}}>{c.active?'🔔':'🔕'}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700}}>{c.name}
                    <span className={`badge ${c.active?'badge-brand':'badge-gray'}`} style={{marginLeft:8}}>{c.active?'เปิด':'ปิด'}</span>
                  </div>
                  <div className="text-xs text-muted">{c.days_after===0?'วันครบกำหนด':`หลังครบกำหนด ${c.days_after} วัน`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
