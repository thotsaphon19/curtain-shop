'use client'
import { useState } from 'react'

interface C { id: string; name: string; owed: number }

export default function BulkNotifyActions({ overdueCustomers }: { overdueCustomers: C[] }) {
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<{ name: string; success: boolean }[]>([])
  const [done, setDone] = useState(false)

  async function notifyAll() {
    if (!confirm(`ส่งแจ้งเตือนไปทุกลูกค้าที่ค้างชำระ ${overdueCustomers.length} คน?`)) return
    setSending(true)
    setDone(false)
    setResults([])

    const res: { name: string; success: boolean }[] = []
    for (const c of overdueCustomers) {
      const r = await fetch('/api/line/notify-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: c.id, channel: 'all' }),
      })
      const data = await r.json()
      res.push({ name: c.name, success: data.success })
      setResults([...res])
    }
    setSending(false)
    setDone(true)
  }

  if (overdueCustomers.length === 0) return null

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0F2027' }}>📣 แจ้งเตือนทุกคนพร้อมกัน</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            ลูกค้าค้างชำระที่มีช่องทาง LINE {overdueCustomers.length} คน
          </div>
        </div>
        <button onClick={notifyAll} disabled={sending}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: sending ? '#aaa' : '#0F2027',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          {sending ? '⏳ กำลังส่ง...' : '📣 ส่งแจ้งเตือนทั้งหมด'}
        </button>
      </div>

      {/* Progress */}
      {(sending || done) && results.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 600 }}>
            ผลการส่ง {results.length}/{overdueCustomers.length}
            {done && ` — ✅ ${results.filter(r => r.success).length} สำเร็จ · ❌ ${results.filter(r => !r.success).length} ไม่สำเร็จ`}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {results.map(r => (
              <span key={r.name} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 8, fontWeight: 600,
                background: r.success ? '#E1F5EE' : '#FCEBEB',
                color: r.success ? '#0F6E56' : '#A32D2D',
              }}>
                {r.success ? '✅' : '❌'} {r.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
