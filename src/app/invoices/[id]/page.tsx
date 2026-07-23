import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import InvoiceActions from './InvoiceActions'
export const dynamic = 'force-dynamic'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const { data: inv } = await supabaseAdmin.from('invoices').select('*, customer:customers(*)').eq('id', id).single()
  if (!inv) redirect('/invoices')

  const cust = (inv as unknown as { customer: { name:string; phone:string; address:string; id:string; line_user_id?:string } }).customer
  const { data: gs } = await supabaseAdmin.from('line_group_settings').select('*').eq('customer_id', cust?.id).maybeSingle()
  const { data: logs } = await supabaseAdmin.from('invoice_group_messages').select('*').eq('invoice_id', id).order('sent_at', { ascending:false })
  const { data: fieldTemplates } = await supabaseAdmin.from('invoice_field_templates').select('*').order('sort_order', { ascending:true })
  const customFields = (inv.custom_fields as Record<string,string>) || {}
  const customEntries = (fieldTemplates || [])
    .filter(f => customFields[f.field_key] !== undefined && customFields[f.field_key] !== '')
    .map(f => [f.label, customFields[f.field_key]] as [string,string])

  const remain = (inv.total || 0) - (inv.paid_amount || 0)
  const ST: Record<string, [string, string]> = {
    unpaid:   ['รอชำระ',       'badge-red'],
    partial:  ['บางส่วน',      'badge-amber'],
    paid:     ['ชำระแล้ว',     'badge-green'],
    overdue:  ['เกินกำหนด',    'badge-red'],
    cancelled:['ยกเลิก',       'badge-gray'],
  }
  const [stLabel, stCls] = ST[inv.status] || ST.unpaid

  return (
    <AppLayout user={session}>
      <div style={{ maxWidth:760 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <a href="/invoices" style={{ color:'var(--text-muted)', fontSize:14 }}>← Invoice</a>
          <h1 style={{ fontSize:20, fontWeight:800, margin:0, color:'var(--dark)' }}>{inv.invoice_no}</h1>
          <span className={`badge ${stCls}`}>{stLabel}</span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
          {/* Invoice info */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--brand)', marginBottom:14 }}>ข้อมูล Invoice</div>
            {[
              ['Invoice No', inv.invoice_no],
              ['ยอดรวม', `฿${(inv.total||0).toLocaleString()}`],
              ['ชำระแล้ว', `฿${(inv.paid_amount||0).toLocaleString()}`],
              ['คงเหลือ', `฿${remain.toLocaleString()}`],
              ['ครบกำหนด', inv.due_date || '-'],
              ['บัญชี', inv.bank_account || '-'],
              ...customEntries,
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', gap:10, marginBottom:8, fontSize:13 }}>
                <span style={{ color:'var(--text-muted)', minWidth:90 }}>{k}</span>
                <span style={{ fontWeight: k==='คงเหลือ'?800:500, color: k==='คงเหลือ'&&remain>0?'var(--red)':'var(--text)' }}>{v}</span>
              </div>
            ))}
            {inv.sent_at && (
              <div style={{ marginTop:10, fontSize:12, color:'var(--green)', fontWeight:600 }}>
                📩 ส่งแล้ว {new Date(inv.sent_at).toLocaleString('th-TH')} ({inv.sent_channel})
              </div>
            )}
          </div>

          {/* Customer + Group status */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--blue)', marginBottom:14 }}>ลูกค้า</div>
            {[['ชื่อ',cust?.name],['โทร',cust?.phone],['ที่อยู่',cust?.address]].map(([k,v])=>(
              <div key={k} style={{ display:'flex', gap:10, marginBottom:8, fontSize:13 }}>
                <span style={{ color:'var(--text-muted)', minWidth:60 }}>{k}</span>
                <span style={{ fontWeight:500 }}>{v||'-'}</span>
              </div>
            ))}
            <div style={{ marginTop:12, padding:'10px 12px', borderRadius:8, background: gs ? 'var(--brand-lt)' : 'var(--gray)' }}>
              {gs ? (
                <>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--brand)' }}>✅ มี LINE Group</div>
                  <div className="text-xs text-muted">{gs.group_name || gs.group_id?.slice(0,16)+'...'}</div>
                  {gs.khunthong_added && <div className="text-xs" style={{ color:'var(--amber)' }}>🏦 ขุนทองอยู่ใน group</div>}
                </>
              ) : (
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>⬜ ยังไม่ได้เชื่อม LINE Group <a href="/settings" style={{ color:'var(--brand)' }}>ตั้งค่า →</a></div>
              )}
            </div>
          </div>

          {/* Actions */}
          <InvoiceActions invoiceId={id} invoiceNo={inv.invoice_no} status={inv.status} hasGroup={!!gs} groupHasKhunthong={gs?.khunthong_added||false} hasCustomerLine={!!cust?.line_user_id}/>
        </div>

        {/* Send logs */}
        {(logs?.length||0) > 0 && (
          <div className="card" style={{ marginTop:16 }}>
            <div className="section-header"><span className="section-title">📝 ประวัติส่ง LINE Group</span></div>
            {logs?.map(log => (
              <div key={log.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 16px', borderBottom:'1px solid #f5f5f5', fontSize:12 }}>
                <span style={{ color:'var(--text-soft)' }}>{new Date(log.sent_at).toLocaleString('th-TH')} — Group: {log.group_id.slice(0,12)}...</span>
                <span style={{ fontWeight:700, color:log.confirmed_at?'var(--green)':'var(--text-muted)' }}>
                  {log.confirmed_at ? `✅ ${new Date(log.confirmed_at).toLocaleString('th-TH', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}` : 'รอยืนยัน'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
