'use client'
import { useState } from 'react'

interface BotAccount { id: string; name: string; line_user_id: string; active: boolean }

export default function PaymentBotSettingsForm({ accounts: initial }: { accounts: BotAccount[] }) {
  const [accounts, setAccounts] = useState<BotAccount[]>(initial)
  const [name, setName] = useState('ขุนทอง (KBank)')
  const [lineUserId, setLineUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000) }

  async function addAccount() {
    const uid = lineUserId.trim()
    if (!uid) return
    setSaving(true)
    const res = await fetch('/api/payment-bot-accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() || 'ขุนทอง (KBank)', line_user_id: uid }),
    })
    const data = await res.json()
    if (data.data) { setAccounts(a => [data.data, ...a]); setLineUserId(''); flash('✅ เพิ่มช่องทางแล้ว') }
    else flash(`❌ ${data.error || 'เพิ่มไม่สำเร็จ'}`, false)
    setSaving(false)
  }

  async function toggleActive(id: string, active: boolean) {
    setAccounts(a => a.map(x => x.id === id ? { ...x, active } : x))
    await fetch(`/api/payment-bot-accounts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }),
    })
  }

  async function deleteAccount(id: string) {
    if (!confirm('ลบช่องทางนี้?')) return
    setAccounts(a => a.filter(x => x.id !== id))
    await fetch(`/api/payment-bot-accounts/${id}`, { method: 'DELETE' })
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>🏦 ช่องทางยืนยันชำระเงินจากบอทธนาคาร (ขุนทอง)</h2>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px' }}>
        เมื่อ @ขุนทองส่งข้อความยืนยันเข้ากลุ่ม LINE ระบบจะตรวจจาก LINE user ID ของขุนทองโดยตรง
        (แม่นยำกว่าการเดา keyword ในข้อความ) แล้วปิด Invoice เป็น &quot;ชำระแล้ว&quot; ให้อัตโนมัติทันที
      </p>

      <div style={{ background: '#F8F9FA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#666' }}>
        💡 <strong>วิธีหา LINE user ID ของขุนทอง:</strong> หลังแอด @ขุนทอง เข้ากลุ่มลูกค้าแล้ว รอให้ขุนทองส่งข้อความเข้ากลุ่มครั้งแรก
        (เช่นตอนแนะนำตัว หรือตอนแจ้งยอดโอน) แล้วเปิดดู log ของ <code>/api/line/webhook</code> ใน Vercel
        จะเห็นบรรทัด <code>[LINE] Group message from: Uxxxxxxx...</code> — copy ค่า user ID นั้นมาใส่ด้านล่างนี้
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="ชื่อบอท เช่น ขุนทอง (KBank)"
          style={{ flex: '1 1 180px', padding: '9px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
        <input value={lineUserId} onChange={e => setLineUserId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addAccount()}
          placeholder="LINE user ID เช่น U1234567890abcdef..."
          style={{ flex: '2 1 240px', padding: '9px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
        <button onClick={addAccount} disabled={saving || !lineUserId.trim()} style={{
          padding: '9px 16px', background: '#0F6E56', color: '#fff', border: 'none',
          borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          opacity: (!lineUserId.trim() || saving) ? 0.5 : 1,
        }}>+ เพิ่ม</button>
      </div>

      {msg && <div style={{ marginBottom: 12, fontSize: 13, color: msg.ok ? '#0F6E56' : '#A32D2D' }}>{msg.text}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {accounts.map(a => (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
            background: a.active ? '#EAF3DE' : '#F1EFE8', border: '1px solid #eee',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: a.active ? '#3B6D11' : '#888' }}>🏦 {a.name}</div>
              <div style={{ fontSize: 11, color: '#aaa', wordBreak: 'break-all' }}>{a.line_user_id}</div>
            </div>
            <button onClick={() => toggleActive(a.id, !a.active)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
              color: a.active ? '#3B6D11' : '#aaa',
            }}>{a.active ? '●' : '○'}</button>
            <button onClick={() => deleteAccount(a.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#A32D2D',
            }}>🗑️</button>
          </div>
        ))}
        {accounts.length === 0 && <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: 12 }}>ยังไม่ได้ลงทะเบียนบอทยืนยันการชำระเงิน</div>}
      </div>
    </div>
  )
}
