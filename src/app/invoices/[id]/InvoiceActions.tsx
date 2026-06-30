'use client'
import { useState } from 'react'

export default function InvoiceActions({ invoiceId, invoiceNo, status, hasGroup, groupHasKhunthong }: {
  invoiceId:string; invoiceNo:string; status:string; hasGroup:boolean; groupHasKhunthong:boolean
}) {
  const [loading, setLoading] = useState<string|null>(null)
  const [msg, setMsg] = useState('')

  async function sendToGroup() {
    setLoading('group'); setMsg('')
    const res = await fetch('/api/line/group', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({invoice_id:invoiceId}),
    })
    const data = await res.json()
    setMsg(data.success
      ? `✅ ส่ง Invoice ${invoiceNo} เข้า LINE Group แล้ว${groupHasKhunthong?' (ขุนทองเห็นด้วย)':''}`
      : `❌ ${data.error||'ส่งไม่สำเร็จ'}`)
    setLoading(null)
  }

  async function markPaid() {
    setLoading('paid')
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({status:'paid', paid_at:new Date().toISOString()}),
    })
    const data = await res.json()
    setMsg(data.data?'✅ อัปเดตเป็นชำระแล้ว':'❌ '+(data.error||'ไม่สำเร็จ'))
    setLoading(null)
    if (data.data) setTimeout(()=>location.reload(),800)
  }

  async function sendReminder() {
    setLoading('remind')
    const res = await fetch('/api/payments/remind', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({invoice_id:invoiceId}),
    })
    setMsg(res.ok?'✅ ส่งแจ้งเตือนแล้ว':'❌ ส่งไม่สำเร็จ')
    setLoading(null)
  }

  const isPaid = status==='paid'||status==='cancelled'

  return (
    <div className="card" style={{ padding:20 }}>
      <div style={{ fontSize:14, fontWeight:700, color:'var(--purple)', marginBottom:14 }}>การดำเนินการ</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
        {hasGroup && !isPaid && (
          <button onClick={sendToGroup} disabled={loading==='group'} className="btn btn-primary" style={{ background:'var(--brand)' }}>
            💬 {loading==='group'?'กำลังส่ง...':'ส่งเข้า LINE Group'}
            {groupHasKhunthong?' + ขุนทอง':''}
          </button>
        )}
        {!isPaid && (
          <button onClick={sendReminder} disabled={loading==='remind'} className="btn btn-amber">
            🔔 {loading==='remind'?'กำลังส่ง...':'แจ้งเตือน LINE DM'}
          </button>
        )}
        {!isPaid && (
          <button onClick={markPaid} disabled={loading==='paid'} className="btn btn-ghost" style={{ background:'var(--green-lt)', color:'var(--green)', fontWeight:700 }}>
            ✅ {loading==='paid'?'กำลังอัปเดต...':'ยืนยันชำระแล้ว'}
          </button>
        )}
        {!hasGroup && !isPaid && (
          <a href="/settings" className="btn btn-ghost">⚙️ ตั้งค่า LINE Group</a>
        )}
      </div>
      {hasGroup && groupHasKhunthong && !isPaid && (
        <div className="alert alert-warning" style={{ marginTop:12, fontSize:12 }}>
          🏦 ขุนทองอยู่ใน group แล้ว เมื่อลูกค้าโอนและพิมพ์ &quot;โอนแล้ว&quot; ระบบอัปเดตอัตโนมัติ
        </div>
      )}
      {msg && <div className={`alert ${msg.startsWith('✅')?'alert-success':'alert-error'}`} style={{ marginTop:10 }}>{msg}</div>}
    </div>
  )
}
