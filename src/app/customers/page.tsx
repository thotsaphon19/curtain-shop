import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import SearchBar from '@/components/ui/SearchBar'
export const dynamic = 'force-dynamic'

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const { q = '' } = await searchParams

  let query = supabaseAdmin.from('customers').select('*').order('name')
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,address.ilike.%${q}%`)
  const { data: customers } = await query

  // ดึง "ชื่อเรียกที่ตั้งเอง" (ตั้งไว้ที่ Settings → คนที่เคยทัก LINE OA เข้ามา) มาโชว์คู่กับชื่อลูกค้าด้วย
  const lineIds = (customers || []).filter(c => c.line_user_id).map(c => c.line_user_id)
  let noteMap: Record<string, string> = {}
  if (lineIds.length > 0) {
    const { data: notes } = await supabaseAdmin.from('line_seen_contacts').select('line_id, note').in('line_id', lineIds)
    noteMap = Object.fromEntries((notes || []).filter(n => n.note).map(n => [n.line_id, n.note]))
  }

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div><h1 className="page-title">👤 ลูกค้า</h1><p className="page-subtitle">ลูกค้าทั้งหมด {customers?.length||0} ราย</p></div>
          <a href="/customers/new" className="btn btn-primary">+ เพิ่มลูกค้า</a>
        </div>

        <SearchBar action="/customers" placeholder="ค้นหาชื่อ เบอร์โทร หรือที่อยู่..." defaultValue={q} />

        <div className="card" style={{ marginTop: 16 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ชื่อ</th><th className="hide-mobile">ชื่อเรียก</th><th className="hide-mobile">โทร</th><th className="hide-mobile">ที่อยู่</th><th>LINE</th><th></th></tr></thead>
              <tbody>
                {(customers||[]).map(c=>(
                  <tr key={c.id}>
                    <td>
                      <a href={`/customers/${c.id}`} style={{fontWeight:700,color:'var(--text)',fontSize:14}}>{c.name}</a>
                      <div className="text-xs text-muted show-mobile">{c.phone}</div>
                    </td>
                    <td className="hide-mobile text-small">
                      {c.line_user_id && noteMap[c.line_user_id]
                        ? <span style={{color:'var(--brand)',fontWeight:600}}>🏷️ {noteMap[c.line_user_id]}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="hide-mobile text-small text-muted">{c.phone}</td>
                    <td className="hide-mobile text-small text-muted" style={{maxWidth:200}}>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}>{c.address}</span>
                    </td>
                    <td><span className={`badge ${c.line_user_id?'badge-brand':'badge-gray'}`}>{c.line_user_id?'✅ ผูกแล้ว':'—'}</span></td>
                    <td><a href={`/customers/${c.id}`} style={{color:'var(--brand)',fontSize:12,fontWeight:700}}>ดู →</a></td>
                  </tr>
                ))}
                {!customers?.length&&<tr><td colSpan={6} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>{q ? `ไม่พบลูกค้าที่ตรงกับ "${q}"` : 'ยังไม่มีลูกค้า'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
