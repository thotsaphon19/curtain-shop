'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Customer } from '@/types'

export default function CustomerActions({ customer }: { customer: Customer }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    line_user_id: customer.line_user_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')

  async function save() {
    setSaving(true); setMsg('')
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.data) {
      setMsg('✅ บันทึกแล้ว')
      setEditing(false)
      setTimeout(() => router.refresh(), 500)
    } else {
      setMsg(`❌ ${data.error || 'ไม่สำเร็จ'}`)
    }
    setSaving(false)
  }

  async function remove() {
    if (!confirm(`ลบลูกค้า "${customer.name}" ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return
    setDeleting(true)
    const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      router.push('/customers')
    } else {
      setMsg(`❌ ${data.error || 'ลบไม่สำเร็จ'}`)
      setDeleting(false)
    }
  }

  if (!editing) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setEditing(true)} className="btn btn-secondary">✏️ แก้ไขข้อมูล</button>
        <button onClick={remove} disabled={deleting} className="btn btn-danger">
          {deleting ? 'กำลังลบ...' : '🗑 ลบลูกค้า'}
        </button>
        {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ flexBasis: '100%' }}>{msg}</div>}
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple)', marginBottom: 14 }}>แก้ไขข้อมูลลูกค้า</div>

      <div style={{ marginBottom: 12 }}>
        <label className="label">ชื่อ</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="label">เบอร์โทร</label>
        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="label">ที่อยู่</label>
        <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="textarea" rows={3} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="label">LINE User ID</label>
        <input value={form.line_user_id} onChange={e => setForm(f => ({ ...f, line_user_id: e.target.value }))} className="input" placeholder="ยังไม่ผูก LINE" />
      </div>

      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
          {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
        </button>
        <button onClick={() => setEditing(false)} className="btn btn-ghost">ยกเลิก</button>
      </div>
    </div>
  )
}
