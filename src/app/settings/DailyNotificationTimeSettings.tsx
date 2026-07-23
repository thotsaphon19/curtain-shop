'use client'
import { useState, useEffect } from 'react'

export default function DailyNotificationTimeSettings() {
  const [time, setTime] = useState('08:00')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings/daily-notification-time').then(r => r.json()).then(d => {
      if (d.value) setTime(d.value)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/settings/daily-notification-time', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time }),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
      else alert('บันทึกไม่สำเร็จ')
    } catch { alert('เกิดข้อผิดพลาด') }
    setSaving(false)
  }

  if (loading) return null

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>⏰ เวลาแจ้งเตือนตารางงานประจำวันให้ช่าง</h3>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 14px' }}>
        ทุกวัน ระบบจะส่งสรุปตารางงานของวันนั้นไปหาช่างแต่ละคนทาง LINE โดยอัตโนมัติ
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ fontSize: 13 }}>
          {saving ? '⏳ กำลังบันทึก...' : 'บันทึก'}
        </button>
        {saved && <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>✅ บันทึกแล้ว</span>}
      </div>
    </div>
  )
}
