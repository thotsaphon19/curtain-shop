import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import BulkNotifyActions from './BulkNotifyActions'
export const dynamic = 'force-dynamic'

export default async function LineNotifyPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const { data: customers } = await supabaseAdmin.from('customers').select('*').order('name')
  const { data: invoices } = await supabaseAdmin.from('invoices').select('customer_id,id,invoice_no,total,paid_amount,status,due_date').in('status',['unpaid','partial','overdue'])
  const { data: groups } = await supabaseAdmin.from('line_group_settings').select('*')

  const invByCustomer = new Map<string, typeof invoices>()
  for (const inv of invoices||[]) {
    const arr = invByCustomer.get(inv.customer_id)||[]
    arr.push(inv); invByCustomer.set(inv.customer_id, arr)
  }
  type GroupRow = NonNullable<typeof groups>[number]
  const groupByCustomer = new Map<string, GroupRow>()
  for (const g of groups||[]) groupByCustomer.set(g.customer_id, g)

  const data = (customers||[]).map(c => {
    const unpaid = invByCustomer.get(c.id)||[]
    const owed = unpaid.reduce((s,i)=>s+((i.total||0)-(i.paid_amount||0)),0)
    const group = groupByCustomer.get(c.id)
    return { ...c, unpaid, owed, group }
  }).sort((a,b) => b.owed - a.owed || a.name.localeCompare(b.name))

  const totalOwedAll = data.reduce((s,c)=>s+c.owed,0)
  const withDebt = data.filter(c=>c.owed>0)

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">📣 แจ้งเตือน LINE รายบุคคล</h1>
            <p className="page-subtitle">LINE DM · LINE Group · ขุนทอง (KBank)</p>
          </div>
        </div>

        <div className="stat-grid">
          {[
            {label:'ยอดค้างรวม',value:`฿${totalOwedAll.toLocaleString()}`,icon:'💰',color:'var(--red)',bg:'var(--red-lt)'},
            {label:'มีหนี้ค้าง',value:withDebt.length,icon:'📋',color:'var(--amber)',bg:'var(--amber-lt)'},
            {label:'ผูก LINE DM',value:data.filter(c=>c.line_user_id).length,icon:'💬',color:'var(--brand)',bg:'var(--brand-lt)'},
            {label:'มีขุนทอง',value:data.filter(c=>c.group?.khunthong_added).length,icon:'🏦',color:'var(--amber)',bg:'var(--amber-lt)'},
          ].map(s=>(
            <div key={s.label} className="stat-card">
              <div style={{fontSize:22,background:s.bg,borderRadius:8,padding:'5px 8px',display:'inline-block',marginBottom:8}}>{s.icon}</div>
              <div className="stat-value" style={{color:s.color}}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <BulkNotifyActions overdueCustomers={withDebt.filter(c=>c.line_user_id||c.group).map(c=>({id:c.id,name:c.name,owed:c.owed}))}/>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>ลูกค้า</th>
                <th>ยอดค้าง</th>
                <th>LINE DM</th>
                <th className="hide-mobile">Group</th>
                <th className="hide-mobile">ขุนทอง</th>
                <th>Action</th>
              </tr></thead>
              <tbody>
                {data.map((c,i) => (
                  <tr key={c.id} style={{background:c.owed>0?(i%2?'#FFFAF5':'#FFF8F5'):undefined}}>
                    <td>
                      <a href={`/customers/${c.id}`} style={{fontWeight:700,fontSize:14,color:'var(--text)'}}>{c.name}</a>
                      <div className="text-xs text-muted">{c.phone}</div>
                    </td>
                    <td>
                      {c.owed>0
                        ? <div><div style={{fontWeight:800,color:'var(--red)',fontSize:14}}>฿{c.owed.toLocaleString()}</div><div className="text-xs text-muted">{c.unpaid.length} inv</div></div>
                        : <span className="badge badge-green">✅ ครบ</span>
                      }
                    </td>
                    <td><span className={`badge ${c.line_user_id?'badge-brand':'badge-gray'}`}>{c.line_user_id?'✅':'—'}</span></td>
                    <td className="hide-mobile"><span className={`badge ${c.group?'badge-blue':'badge-gray'}`}>{c.group?'✅':'—'}</span></td>
                    <td className="hide-mobile"><span className={`badge ${c.group?.khunthong_added?'badge-amber':'badge-gray'}`}>{c.group?.khunthong_added?'🏦':'—'}</span></td>
                    <td>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                        <a href={`/customers/${c.id}`} className="btn btn-secondary" style={{padding:'4px 10px',fontSize:11}}>ดู</a>
                        {c.owed>0&&(c.line_user_id||c.group)&&(
                          <a href={`/customers/${c.id}`} className={`btn ${c.group?.khunthong_added?'btn-khunthong':'btn-line'}`} style={{padding:'4px 10px',fontSize:11}}>
                            {c.group?.khunthong_added?'🏦':'💬'}
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
