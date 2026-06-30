'use client'
import { useState } from 'react'

interface Keyword { id: string; keyword: string; active: boolean }

export default function KeywordSettingsForm({ keywords: initial }: { keywords: Keyword[] }) {
  const [keywords, setKeywords] = useState<Keyword[]>(initial)
  const [newKw, setNewKw] = useState('')
  const [saving, setSaving] = useState(false)

  async function addKeyword() {
    const kw = newKw.trim()
    if (!kw) return
    setSaving(true)
    const res = await fetch('/api/payments/keywords', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw }),
    })
    const data = await res.json()
    if (data.data) { setKeywords(k => [...k, data.data]); setNewKw('') }
    setSaving(false)
  }

  async function toggleKeyword(id: string, active: boolean) {
    setKeywords(k => k.map(x => x.id === id ? { ...x, active } : x))
    await fetch('/api/payments/keywords', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active }),
    })
  }

  async function deleteKeyword(id: string) {
    setKeywords(k => k.filter(x => x.id !== id))
    await fetch(`/api/payments/keywords?id=${id}`, { method: 'DELETE' })
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>💬 Keyword ยืนยันชำระ</h2>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>
        เมื่อลูกค้าพิมพ์ข้อความเหล่านี้ใน LINE Group ระบบจะอัปเดต Invoice เป็น &quot;ชำระแล้ว&quot; อัตโนมัติ
        (ขุนทองก็ส่ง keyword เหล่านี้ด้วย)
      </p>

      {/* Add new keyword */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={newKw} onChange={e => setNewKw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addKeyword()}
          placeholder="เพิ่ม keyword เช่น ยืนยันแล้ว"
          style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
        <button onClick={addKeyword} disabled={saving || !newKw.trim()} style={{
          padding: '9px 16px', background: '#0F6E56', color: '#fff', border: 'none',
          borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          opacity: (!newKw.trim() || saving) ? 0.5 : 1,
        }}>+ เพิ่ม</button>
      </div>

      {/* Keyword list */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {keywords.map(kw => (
          <div key={kw.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 20,
            background: kw.active ? '#E1F5EE' : '#F1EFE8',
            border: `1px solid ${kw.active ? '#5DCAA5' : '#D3D1C7'}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: kw.active ? '#0F6E56' : '#888' }}>
              {kw.keyword}
            </span>
            <button onClick={() => toggleKeyword(kw.id, !kw.active)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px',
              color: kw.active ? '#0F6E56' : '#aaa',
            }}>{kw.active ? '●' : '○'}</button>
            <button onClick={() => deleteKeyword(kw.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '0 2px', color: '#A32D2D',
            }}>×</button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: '#888', background: '#F8F9FA', borderRadius: 8, padding: '8px 12px' }}>
        🤖 <strong>ขุนทองส่ง keyword:</strong> เมื่อขุนทองได้รับการโอนเงินแล้ว จะส่งข้อความ confirm เข้า group
        ซึ่งมักมีคำว่า &quot;ขุนทอง&quot; หรือ &quot;confirm&quot; อยู่ด้วย ระบบจะจับได้อัตโนมัติ
      </div>
    </div>
  )
}
