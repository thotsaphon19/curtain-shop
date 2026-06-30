'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Technician } from '@/types'

export default function TechnicianActions({ technician }: { technician: Technician }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: technician.name,
    phone: technician.phone,
    line_user_id: technician.line_user_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')

  async function save() {
    setSaving(true); setMsg('')
    const res = await fetch(`/api/technicians/${technician.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setMsg(data.data ? '✅ บันทึกแล้ว' : `❌ ${data.error || 'ไม่สำเร็จ'}`)
    setSaving(false)
  }

  async function remove() {
    if (!confirm(`ลบช่าง "${technician.name}" ออกจากระบบ?`)) return
    setDeleting(true)
    const res = await fetch(`/api/technicians/${technician.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      router.push('/technicians')
    } else {
      setMsg(`❌ ${data.error || 'ลบไม่สำเร็จ'}`)
      setDeleting(false)
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple)', marginBottom: 14 }}>ข้อมูลช่าง</div>

      <div style={{ marginBottom: 12 }}>
        <label className="label">ชื่อช่าง</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="label">เบอร์โทร</label>
        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="label">LINE User ID</label>
        <input
          value={form.line_user_id}
          onChange={e => setForm(f => ({ ...f, line_user_id: e.target.value }))}
          className="input" placeholder="ยังไม่ผูก LINE"
        />
      </div>

      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
          {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
        </button>
        <button onClick={remove} disabled={deleting} className="btn btn-danger">
          {deleting ? '...' : '🗑 ลบ'}
        </button>
      </div>
    </div>
  )
}
