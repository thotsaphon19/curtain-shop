'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCustomerPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', phone: '', address: '', line_user_id: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      router.push(`/customers/${data.data.id}`)
    } catch { setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--gray)' }}>
      <header style={{ background: 'var(--dark)', padding: '0 16px', height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/customers" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}>←</a>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>เพิ่มลูกค้าใหม่</span>
      </header>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--content-p)', paddingBottom: 40 }}>
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">ชื่อลูกค้า *</label>
            <input
              required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input" placeholder="เช่น คุณสมหญิง รักสวย"
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
            <label className="label">ที่อยู่ *</label>
            <textarea
              required value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="textarea" rows={3} placeholder="ที่อยู่สำหรับติดตั้ง"
            />
          </div>
          <div>
            <label className="label">LINE User ID (ไม่บังคับ)</label>
            <input
              value={form.line_user_id}
              onChange={e => setForm(f => ({ ...f, line_user_id: e.target.value }))}
              className="input" placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>
          <div>
            <label className="label">หมายเหตุ (ไม่บังคับ)</label>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="input" placeholder="ข้อมูลเพิ่มเติม"
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ justifyContent: 'center', padding: 12 }}>
            {loading ? 'กำลังบันทึก...' : '✅ เพิ่มลูกค้า'}
          </button>
        </form>
      </div>
    </div>
  )
}
