'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewTechnicianPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', phone: '', line_user_id: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/technicians', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      router.push(`/technicians/${data.data.id}`)
    } catch { setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--gray)' }}>
      <header style={{ background: 'var(--dark)', padding: '0 16px', height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/technicians" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}>←</a>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>เพิ่มช่างใหม่</span>
      </header>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--content-p)', paddingBottom: 40 }}>
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">ชื่อช่าง *</label>
            <input
              required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input" placeholder="เช่น สมชาย ใจดี"
            />
          </div>
          <div>
            <label className="label">เบอร์โทร *</label>
            <input
              required value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="input" placeholder="0812345678"
            />
          </div>
          <div>
            <label className="label">LINE User ID (ไม่บังคับ)</label>
            <input
              value={form.line_user_id}
              onChange={e => setForm(f => ({ ...f, line_user_id: e.target.value }))}
              className="input" placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              ใส่เพื่อให้ช่างรับแจ้งเตือนงานผ่าน LINE ได้ทันที
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ justifyContent: 'center', padding: 12 }}>
            {loading ? 'กำลังบันทึก...' : '✅ เพิ่มช่าง'}
          </button>
        </form>
      </div>
    </div>
  )
}
