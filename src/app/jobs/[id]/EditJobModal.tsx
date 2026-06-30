'use client'
import { useState } from 'react'
import { Job } from '@/types'

const FIELDS: { key: keyof Job; label: string; type: string }[] = [
  { key: 'title', label: 'ชื่องาน', type: 'text' },
  { key: 'description', label: 'รายละเอียด', type: 'textarea' },
  { key: 'address', label: 'ที่อยู่', type: 'text' },
  { key: 'scheduled_date', label: 'วันที่นัด', type: 'date' },
  { key: 'scheduled_time', label: 'เวลานัด', type: 'time' },
  { key: 'amount', label: 'ยอดเรียกเก็บ (บาท)', type: 'number' },
  { key: 'bank_account', label: 'เลขบัญชี', type: 'text' },
]

export default function EditJobModal({ job, onClose, onSaved }: {
  job: Job; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    FIELDS.forEach(f => { init[f.key] = (job[f.key] as string | number | undefined)?.toString() ?? '' })
    return init
  })
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // หาว่ามีฟิลด์ไหนถูกแก้จริงไหม เทียบกับค่าเดิม — ใช้ disable ปุ่มบันทึกถ้าไม่มีอะไรเปลี่ยน
  const hasChanges = FIELDS.some(f => {
    const orig = (job[f.key] as string | number | undefined)?.toString() ?? ''
    return form[f.key] !== orig
  })

  async function save() {
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {}
      FIELDS.forEach(f => {
        const orig = (job[f.key] as string | number | undefined)?.toString() ?? ''
        if (form[f.key] !== orig) {
          payload[f.key] = f.type === 'number' ? Number(form[f.key]) : form[f.key]
        }
      })
      if (note.trim()) payload.edit_note = note.trim()

      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        onSaved()
        onClose()
      }
    } catch {
      setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    }
    setSaving(false)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--dark)' }}>✏️ แก้ไขข้อมูลงาน</h3>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 10px' }}>✕</button>
        </div>

        {FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <label className="label">{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="textarea" rows={3}
              />
            ) : (
              <input
                type={f.type}
                value={f.type === 'time' ? form[f.key].slice(0, 5) : form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="input"
              />
            )}
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <label className="label">หมายเหตุการแก้ไข (ไม่บังคับ)</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            className="input"
            placeholder="เช่น ลูกค้าขอเปลี่ยนวันนัด"
          />
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>❌ {error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={saving || !hasChanges} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
            {saving ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
          </button>
          <button onClick={onClose} className="btn btn-ghost">ยกเลิก</button>
        </div>
      </div>
    </div>
  )
}
