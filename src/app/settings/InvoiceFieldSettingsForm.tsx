'use client'
import { useState } from 'react'

interface FieldTemplate {
  id: string; field_key: string; label: string
  field_type: 'text' | 'number' | 'date' | 'textarea'
  required: boolean; sort_order: number; active: boolean
}

const TYPE_LABEL: Record<string, string> = { text: 'ข้อความ', number: 'ตัวเลข', date: 'วันที่', textarea: 'ข้อความยาว' }

export default function InvoiceFieldSettingsForm({ fields: initial }: { fields: FieldTemplate[] }) {
  const [fields, setFields] = useState<FieldTemplate[]>(initial)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<'text' | 'number' | 'date' | 'textarea'>('text')
  const [newRequired, setNewRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  async function addField() {
    const label = newLabel.trim()
    if (!label) return
    setSaving(true)
    const res = await fetch('/api/invoice-field-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field_key: label, label, field_type: newType, required: newRequired }),
    })
    const data = await res.json()
    if (data.data) { setFields(f => [...f, data.data]); setNewLabel(''); setNewRequired(false) }
    setSaving(false)
  }

  async function toggleActive(id: string, active: boolean) {
    setFields(f => f.map(x => x.id === id ? { ...x, active } : x))
    await fetch(`/api/invoice-field-templates/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }),
    })
  }

  async function toggleRequired(id: string, required: boolean) {
    setFields(f => f.map(x => x.id === id ? { ...x, required } : x))
    await fetch(`/api/invoice-field-templates/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ required }),
    })
  }

  function startEdit(f: FieldTemplate) { setEditingId(f.id); setEditLabel(f.label) }

  async function saveEdit(id: string) {
    const label = editLabel.trim()
    if (!label) { setEditingId(null); return }
    setFields(f => f.map(x => x.id === id ? { ...x, label } : x))
    setEditingId(null)
    await fetch(`/api/invoice-field-templates/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }),
    })
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = fields.findIndex(f => f.id === id)
    const swapIdx = idx + dir
    if (idx < 0 || swapIdx < 0 || swapIdx >= fields.length) return
    const next = [...fields]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setFields(next)
    await Promise.all([
      fetch(`/api/invoice-field-templates/${next[idx].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: idx }) }),
      fetch(`/api/invoice-field-templates/${next[swapIdx].id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: swapIdx }) }),
    ])
  }

  async function deleteField(id: string) {
    if (!confirm('ลบฟิลด์นี้ถาวร? (ค่าที่เคยกรอกใน Invoice เก่าจะยังอยู่ แต่ฟอร์มจะไม่แสดงฟิลด์นี้อีก)')) return
    setFields(f => f.filter(x => x.id !== id))
    await fetch(`/api/invoice-field-templates/${id}`, { method: 'DELETE' })
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>🧾 ฟิลด์เพิ่มเติมใน Invoice</h2>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>
        กำหนดฟิลด์ในแบบของร้านเอง เช่น จุดติดตั้ง, เลขที่สัญญา, ระยะประกัน — เพิ่ม/แก้ไข/ลบได้อิสระ
        Invoice ของร้านนี้เป็นงานติดตั้งบริการ ไม่มีรายการสินค้าแยก
      </p>

      {/* Add new field */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addField()}
          placeholder="ชื่อฟิลด์ใหม่ เช่น จุดติดตั้ง"
          style={{ flex: '1 1 200px', padding: '9px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
        <select value={newType} onChange={e => setNewType(e.target.value as typeof newType)}
          style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666' }}>
          <input type="checkbox" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} /> บังคับกรอก
        </label>
        <button onClick={addField} disabled={saving || !newLabel.trim()} style={{
          padding: '9px 16px', background: '#0F6E56', color: '#fff', border: 'none',
          borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          opacity: (!newLabel.trim() || saving) ? 0.5 : 1,
        }}>+ เพิ่มฟิลด์</button>
      </div>

      {/* Field list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fields.map((f, i) => (
          <div key={f.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
            background: f.active ? '#F8F9FA' : '#F1EFE8', border: '1px solid #eee',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={() => move(f.id, -1)} disabled={i === 0} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, opacity: i === 0 ? 0.3 : 1 }}>▲</button>
              <button onClick={() => move(f.id, 1)} disabled={i === fields.length - 1} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, opacity: i === fields.length - 1 ? 0.3 : 1 }}>▼</button>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {editingId === f.id ? (
                <input autoFocus value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit(f.id)} onBlur={() => saveEdit(f.id)}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #0F6E56', fontSize: 13, width: '100%', boxSizing: 'border-box' }} />
              ) : (
                <span onClick={() => startEdit(f)} style={{ fontSize: 13, fontWeight: 600, color: f.active ? '#0F2027' : '#888', cursor: 'text' }}>
                  {f.label} {f.required && <span style={{ color: '#A32D2D' }}>*</span>}
                </span>
              )}
              <div style={{ fontSize: 11, color: '#aaa' }}>{TYPE_LABEL[f.field_type]} · {f.field_key}</div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={f.required} onChange={e => toggleRequired(f.id, e.target.checked)} /> บังคับ
            </label>

            <button onClick={() => toggleActive(f.id, !f.active)} title={f.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
              color: f.active ? '#0F6E56' : '#aaa',
            }}>{f.active ? '●' : '○'}</button>

            <button onClick={() => deleteField(f.id)} title="ลบถาวร" style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#A32D2D',
            }}>🗑️</button>
          </div>
        ))}
        {fields.length === 0 && <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: 12 }}>ยังไม่มีฟิลด์เพิ่มเติม</div>}
      </div>
    </div>
  )
}
