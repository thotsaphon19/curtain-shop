import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')
  const { data: customers } = await supabaseAdmin.from('customers').select('*').order('name')
  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div><h1 className="page-title">👤 ลูกค้า</h1><p className="page-subtitle">ลูกค้าทั้งหมด {customers?.length||0} ราย</p></div>
          <a href="/customers/new" className="btn btn-primary">+ เพิ่มลูกค้า</a>
        </div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>ชื่อ</th><th className="hide-mobile">โทร</th><th className="hide-mobile">ที่อยู่</th><th>LINE</th><th></th></tr></thead>
              <tbody>
                {(customers||[]).map(c=>(
                  <tr key={c.id}>
                    <td>
                      <a href={`/customers/${c.id}`} style={{fontWeight:700,color:'var(--text)',fontSize:14}}>{c.name}</a>
                      <div className="text-xs text-muted show-mobile">{c.phone}</div>
                    </td>
                    <td className="hide-mobile text-small text-muted">{c.phone}</td>
                    <td className="hide-mobile text-small text-muted" style={{maxWidth:200}}>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}>{c.address}</span>
                    </td>
                    <td><span className={`badge ${c.line_user_id?'badge-brand':'badge-gray'}`}>{c.line_user_id?'✅ ผูกแล้ว':'—'}</span></td>
                    <td><a href={`/customers/${c.id}`} style={{color:'var(--brand)',fontSize:12,fontWeight:700}}>ดู →</a></td>
                  </tr>
                ))}
                {!customers?.length&&<tr><td colSpan={5} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>ยังไม่มีลูกค้า</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
