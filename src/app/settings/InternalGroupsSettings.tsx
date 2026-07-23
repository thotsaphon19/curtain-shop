'use client'
import { useState, useEffect } from 'react'

interface Group {
  id: string
  group_type: string
  name: string
  line_group_id: string
  description?: string
  active: boolean
  notify_events?: string[]
  oa_account_id?: string | null
}

interface OAAccountOption { id: string; name: string; is_default: boolean; active: boolean }

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; desc: string }> = {
  technician_team: { icon: '👷', label: 'กลุ่มช่าง',         color: 'var(--amber)',  desc: 'แจ้งงานใหม่ ตารางงานประจำวัน' },
  broadcast:       { icon: '📢', label: 'แจ้งเตือนทั่วไป',   color: 'var(--brand)',  desc: 'เลือกได้ว่าแต่ละกลุ่มรับแจ้งเตือนเรื่องอะไรบ้าง (รองรับหลายสิบกลุ่ม)' },
  other:           { icon: '💬', label: 'อื่นๆ',             color: 'var(--purple)', desc: 'กลุ่มแจ้งเตือนทั่วไป' },
}

const TYPES = ['technician_team', 'broadcast', 'other']

// ── ประเภทเหตุการณ์ที่กลุ่ม "แจ้งเตือนทั่วไป" เลือก subscribe ได้ ────────────
const EVENT_CONFIG: Record<string, { icon: string; label: string }> = {
  new_job:            { icon: '🆕', label: 'มีงานใหม่เข้ามา' },
  job_edited:         { icon: '✏️', label: 'มีการแก้ไขข้อมูลงาน' },
  invoice_sent:       { icon: '🧾', label: 'ส่งใบแจ้งหนี้' },
  payment_confirmed:  { icon: '💰', label: 'ลูกค้าชำระเงินแล้ว' },
  job_completed:      { icon: '✅', label: 'งานเสร็จสมบูรณ์' },
}
const EVENT_KEYS = Object.keys(EVENT_CONFIG)

export default function InternalGroupsSettings({ initialGroups }: { initialGroups: Group[] }) {
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [oaAccounts, setOaAccounts] = useState<OAAccountOption[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<{ group_type: string; name: string; line_group_id: string; description: string; notify_events: string[]; oa_account_id: string }>(
    { group_type: 'technician_team', name: '', line_group_id: '', description: '', notify_events: [], oa_account_id: '' }
  )
  const [editForm, setEditForm] = useState<Partial<Group>>({})

  useEffect(() => {
    fetch('/api/settings/line-oa-accounts').then(r => r.json()).then(d => setOaAccounts(d.data || []))
  }, [])

  function toggleEvent(list: string[] | undefined, key: string): string[] {
    const cur = list || []
    return cur.includes(key) ? cur.filter(e => e !== key) : [...cur, key]
  }
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000) }

  async function addGroup() {
    if (!form.name || !form.line_group_id) return
    setSaving(true)
    const res = await fetch('/api/settings/line-groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, oa_account_id: form.oa_account_id || null }),
    })
    const data = await res.json()
    if (data.data) {
      setGroups(g => [...g, data.data])
      setForm({ group_type: 'technician_team', name: '', line_group_id: '', description: '', notify_events: [], oa_account_id: '' })
      setShowAdd(false)
      flash('✅ เพิ่มกลุ่มแล้ว')
    } else flash('❌ ' + data.error, false)
    setSaving(false)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/settings/line-groups/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (data.data) {
      setGroups(g => g.map(x => x.id === id ? { ...x, ...editForm } : x))
      setEditId(null)
      flash('✅ บันทึกแล้ว')
    } else flash('❌ ' + data.error, false)
    setSaving(false)
  }

  async function toggleActive(id: string, active: boolean) {
    setSaving(true)
    const res = await fetch(`/api/settings/line-groups/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }),
    })
    if (res.ok) setGroups(g => g.map(x => x.id === id ? { ...x, active } : x))
    setSaving(false)
  }

  async function deleteGroup(id: string, name: string) {
    if (!confirm(`ลบกลุ่ม "${name}"?`)) return
    setSaving(true)
    const res = await fetch(`/api/settings/line-groups/${id}`, { method: 'DELETE' })
    if (res.ok) { setGroups(g => g.filter(x => x.id !== id)); flash('✅ ลบแล้ว') }
    else flash('❌ ลบไม่สำเร็จ', false)
    setSaving(false)
  }

  // Group by type
  const grouped = TYPES.reduce((acc, t) => {
    acc[t] = groups.filter(g => g.group_type === t)
    return acc
  }, {} as Record<string, Group[]>)

  return (
    <div>
      {msg && (
        <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {/* How to get group ID */}
      <div style={{ background: 'linear-gradient(135deg,#E1F5EE,#E6F1FB)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontSize: 12, color: 'var(--dark)' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>📋 วิธีหา LINE Group ID</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['สร้างกลุ่ม LINE', 'แอด LINE OA ร้านเข้ากลุ่ม', 'ให้ใครส่งข้อความในกลุ่ม 1 ครั้ง', 'เลื่อนขึ้นไปหัวข้อ "🪪 คนและกลุ่มที่เคยทัก LINE OA" → แท็บ "กลุ่ม LINE" → กดคัดลอก'].map((t,i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ background: 'var(--brand)', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i+1}</div>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>
          Group ID ขึ้นต้นด้วย <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4 }}>C</code> เช่น <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4 }}>C1234567890abcdef</code>
        </div>
      </div>

      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary">
          {showAdd ? 'ยกเลิก' : '+ เพิ่มกลุ่ม LINE'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card" style={{ padding: 20, marginBottom: 16, border: '2px solid var(--brand)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>เพิ่มกลุ่ม LINE ใหม่</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="label">ประเภทกลุ่ม *</label>
              <select value={form.group_type} onChange={e => setForm(f => ({ ...f, group_type: e.target.value }))} className="input">
                {TYPES.map(t => <option key={t} value={t}>{TYPE_CONFIG[t].icon} {TYPE_CONFIG[t].label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">ชื่อกลุ่ม *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="input" placeholder="เช่น ทีม A สายเหนือ" />
            </div>
            <div>
              <label className="label">LINE Group ID *</label>
              <input value={form.line_group_id} onChange={e => setForm(f => ({ ...f, line_group_id: e.target.value }))}
                className="input" placeholder="Cxxxxxxxxxxxxxxx" />
            </div>
            <div>
              <label className="label">หมายเหตุ</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="input" placeholder="(ไม่บังคับ)" />
            </div>
            {oaAccounts.length > 1 && (
              <div>
                <label className="label">ส่งผ่านบัญชี OA</label>
                <select value={form.oa_account_id} onChange={e => setForm(f => ({ ...f, oa_account_id: e.target.value }))} className="input">
                  <option value="">⭐ ใช้บัญชี default</option>
                  {oaAccounts.map(a => <option key={a.id} value={a.id}>{a.name}{!a.active ? ' (ปิดใช้)' : ''}</option>)}
                </select>
              </div>
            )}
          </div>

          {form.group_type === 'broadcast' && (
            <div style={{ marginBottom: 12 }}>
              <label className="label">รับแจ้งเตือนเรื่องไหนบ้าง (เลือกได้หลายข้อ)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {EVENT_KEYS.map(key => {
                  const ev = EVENT_CONFIG[key]
                  const checked = form.notify_events.includes(key)
                  return (
                    <label key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                      border: `1.5px solid ${checked ? 'var(--brand)' : 'var(--border)'}`,
                      background: checked ? 'var(--brand-lt)' : '#fff', cursor: 'pointer', fontSize: 12,
                    }}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setForm(f => ({ ...f, notify_events: toggleEvent(f.notify_events, key) }))} />
                      {ev.icon} {ev.label}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addGroup} disabled={saving || !form.name || !form.line_group_id}
              className="btn btn-primary">{saving ? 'กำลังบันทึก...' : '✅ เพิ่มกลุ่ม'}</button>
            <button onClick={() => setShowAdd(false)} className="btn btn-ghost">ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Groups by category */}
      {TYPES.map(type => {
        const tc = TYPE_CONFIG[type]
        const typeGroups = grouped[type] || []
        return (
          <div key={type} className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray)' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{tc.icon} {tc.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{tc.desc}</span>
              </div>
              <span className="badge badge-gray">{typeGroups.length} กลุ่ม</span>
            </div>

            {typeGroups.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                ยังไม่มีกลุ่ม — กด "+ เพิ่มกลุ่ม LINE" ด้านบน
              </div>
            ) : typeGroups.map(g => (
              <div key={g.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                {editId === g.id ? (
                  // Edit row
                  <div style={{ padding: '12px 16px', background: 'var(--brand-lt)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label className="label">ชื่อกลุ่ม</label>
                        <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="input" style={{ fontSize: 12 }} />
                      </div>
                      <div>
                        <label className="label">LINE Group ID</label>
                        <input value={editForm.line_group_id || ''} onChange={e => setEditForm(f => ({ ...f, line_group_id: e.target.value }))} className="input" style={{ fontSize: 12 }} />
                      </div>
                      <div>
                        <label className="label">หมายเหตุ</label>
                        <input value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="input" style={{ fontSize: 12 }} />
                      </div>
                      {oaAccounts.length > 1 && (
                        <div>
                          <label className="label">ส่งผ่านบัญชี OA</label>
                          <select value={editForm.oa_account_id || ''} onChange={e => setEditForm(f => ({ ...f, oa_account_id: e.target.value || null }))} className="input" style={{ fontSize: 12 }}>
                            <option value="">⭐ ใช้บัญชี default</option>
                            {oaAccounts.map(a => <option key={a.id} value={a.id}>{a.name}{!a.active ? ' (ปิดใช้)' : ''}</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    {g.group_type === 'broadcast' && (
                      <div style={{ marginBottom: 10 }}>
                        <label className="label">รับแจ้งเตือนเรื่องไหนบ้าง</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                          {EVENT_KEYS.map(key => {
                            const ev = EVENT_CONFIG[key]
                            const checked = (editForm.notify_events || []).includes(key)
                            return (
                              <label key={key} style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
                                border: `1.5px solid ${checked ? 'var(--brand)' : 'var(--border)'}`,
                                background: checked ? 'var(--brand-lt)' : '#fff', cursor: 'pointer', fontSize: 11,
                              }}>
                                <input type="checkbox" checked={checked}
                                  onChange={() => setEditForm(f => ({ ...f, notify_events: toggleEvent(f.notify_events, key) }))} />
                                {ev.icon} {ev.label}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => saveEdit(g.id)} disabled={saving} className="btn btn-primary" style={{ fontSize: 11, padding: '5px 12px' }}>💾 บันทึก</button>
                      <button onClick={() => setEditId(null)} className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }}>ยกเลิก</button>
                    </div>
                  </div>
                ) : (
                  // Display row
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: g.active ? 'var(--dark)' : 'var(--text-muted)' }}>{g.name}</span>
                        {!g.active && <span className="badge badge-gray" style={{ fontSize: 9 }}>ปิดใช้</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        <code style={{ background: 'var(--gray)', padding: '1px 5px', borderRadius: 3 }}>{g.line_group_id}</code>
                        {g.description && <span style={{ marginLeft: 8 }}>· {g.description}</span>}
                        {g.oa_account_id && oaAccounts.length > 1 && (
                          <span style={{ marginLeft: 8 }}>· 📡 {oaAccounts.find(a => a.id === g.oa_account_id)?.name || 'OA ที่ถูกลบไปแล้ว'}</span>
                        )}
                      </div>
                      {g.group_type === 'broadcast' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                          {(g.notify_events || []).length === 0 ? (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>ยังไม่เลือกรับเรื่องใด — กด ✏️ เพื่อตั้งค่า</span>
                          ) : (g.notify_events || []).map(key => (
                            <span key={key} className="badge badge-gray" style={{ fontSize: 10 }}>
                              {EVENT_CONFIG[key]?.icon} {EVENT_CONFIG[key]?.label || key}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button onClick={() => { setEditId(g.id); setEditForm({ name: g.name, line_group_id: g.line_group_id, description: g.description, notify_events: g.notify_events || [], oa_account_id: g.oa_account_id || null }) }}
                        className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 9px' }}>✏️</button>
                      <button onClick={() => toggleActive(g.id, !g.active)} disabled={saving}
                        className={`btn ${g.active ? 'btn-ghost' : 'btn-secondary'}`} style={{ fontSize: 11, padding: '4px 9px' }}>
                        {g.active ? '⏸ ปิด' : '▶ เปิด'}
                      </button>
                      <button onClick={() => deleteGroup(g.id, g.name)} disabled={saving}
                        className="btn btn-danger" style={{ fontSize: 11, padding: '4px 9px' }}>🗑</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
