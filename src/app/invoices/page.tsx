import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
export const dynamic = 'force-dynamic'

export default async function InvoicesPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')
  const { data: invoices } = await supabaseAdmin.from('invoices').select('*, customer:customers(name,phone)').order('created_at',{ascending:false})
  const total=invoices?.length||0
  const paid=invoices?.filter(i=>i.status==='paid').length||0
  const unpaid=invoices?.filter(i=>['unpaid','partial','overdue'].includes(i.status)).length||0
  const revenue=invoices?.filter(i=>i.status==='paid').reduce((s,i)=>s+(i.total||0),0)||0
  const S: Record<string,[string,string]> = {
    unpaid:  ['รอชำระ','badge badge-red'],
    partial: ['บางส่วน','badge badge-amber'],
    paid:    ['ชำระแล้ว','badge badge-green'],
    overdue: ['เกินกำหนด','badge badge-red'],
    cancelled:['ยกเลิก','badge badge-gray'],
  }
  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div><h1 className="page-title">💳 Invoice</h1></div>
          <a href="/invoices/new" className="btn btn-primary">+ สร้าง Invoice</a>
        </div>
        <div className="stat-grid">
          {[
            {label:'ทั้งหมด',value:total,icon:'📋',color:'var(--blue)',bg:'var(--blue-lt)'},
            {label:'ชำระแล้ว',value:paid,icon:'✅',color:'var(--green)',bg:'var(--green-lt)'},
            {label:'รอชำระ',value:unpaid,icon:'⏳',color:'var(--red)',bg:'var(--red-lt)'},
            {label:'รายได้รวม',value:`฿${revenue.toLocaleString()}`,icon:'💰',color:'var(--amber)',bg:'var(--amber-lt)'},
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
              <thead><tr><th>Invoice</th><th>ลูกค้า</th><th>ยอดรวม</th><th>คงเหลือ</th><th className="hide-mobile">ครบกำหนด</th><th>สถานะ</th><th></th></tr></thead>
              <tbody>
                {(invoices||[]).map((inv,i)=>{
                  const [label,cls]=S[inv.status]||S.unpaid
                  const cust=(inv as unknown as {customer:{name:string,phone:string}}).customer
                  const isOver=inv.due_date&&new Date(inv.due_date)<new Date()&&inv.status!=='paid'
                  const remain=(inv.total||0)-(inv.paid_amount||0)
                  return (
                    <tr key={inv.id} style={{background:isOver?(i%2?'#FFF5F5':'#FFF8F8'):undefined}}>
                      <td style={{fontWeight:700,fontSize:13}}>{inv.invoice_no}</td>
                      <td><div style={{fontWeight:600,fontSize:13}}>{cust?.name}</div><div className="text-xs text-muted">{cust?.phone}</div></td>
                      <td style={{fontWeight:700}}>฿{(inv.total||0).toLocaleString()}</td>
                      <td style={{fontWeight:remain>0?800:400,color:remain>0?'var(--red)':'var(--green)'}}>{remain>0?`฿${remain.toLocaleString()}`:'-'}</td>
                      <td className="hide-mobile text-small" style={{color:isOver?'var(--red)':'var(--text-soft)'}}>{inv.due_date||'-'}{isOver&&<div className="text-xs" style={{color:'var(--red)'}}>⚠️</div>}</td>
                      <td><span className={cls}>{label}</span></td>
                      <td><a href={`/invoices/${inv.id}`} style={{color:'var(--brand)',fontSize:12,fontWeight:700}}>ดู →</a></td>
                    </tr>
                  )
                })}
                {!total&&<tr><td colSpan={7} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>ยังไม่มี Invoice</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
