import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
export const dynamic = 'force-dynamic'

export default async function QuotationsPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')
  const { data: quotations } = await supabaseAdmin.from('quotations').select('*, customer:customers(name,phone), quotation_items(id)').order('created_at',{ascending:false})
  const S: Record<string,[string,string]> = {
    draft:    ['ร่าง','badge badge-gray'],
    sent:     ['ส่งแล้ว','badge badge-blue'],
    approved: ['อนุมัติ','badge badge-green'],
    rejected: ['ปฏิเสธ','badge badge-red'],
  }
  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div><h1 className="page-title">📋 ใบเสนอราคา</h1></div>
          <a href="/quotations/new" className="btn btn-primary">+ สร้าง</a>
        </div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>เลขที่</th><th>ลูกค้า</th><th className="hide-mobile">รายการ</th><th>ยอดรวม</th><th>สถานะ</th><th></th></tr></thead>
              <tbody>
                {(quotations||[]).map(qt=>{
                  const [label,cls]=S[qt.status]||S.draft
                  const cust=(qt as unknown as {customer:{name:string,phone:string}}).customer
                  const items=(qt as unknown as {quotation_items:{id:string}[]}).quotation_items
                  return (
                    <tr key={qt.id}>
                      <td style={{fontWeight:700,fontSize:13}}>{qt.quotation_no}</td>
                      <td><div style={{fontWeight:600,fontSize:13}}>{cust?.name}</div><div className="text-xs text-muted">{cust?.phone}</div></td>
                      <td className="hide-mobile text-small text-muted">{items?.length||0} รายการ</td>
                      <td style={{fontWeight:700}}>฿{(qt.total||0).toLocaleString()}</td>
                      <td><span className={cls}>{label}</span></td>
                      <td><a href={`/quotations/${qt.id}`} style={{color:'var(--brand)',fontSize:12,fontWeight:700}}>ดู →</a></td>
                    </tr>
                  )
                })}
                {!quotations?.length&&<tr><td colSpan={6} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>ยังไม่มีใบเสนอราคา</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
