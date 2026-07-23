'use client'
import { useState } from 'react'

interface Group {
  id: string; customer_id: string; group_id: string; group_name?: string
  khunthong_added: boolean; auto_send: boolean
  customer?: { name: string; phone: string }
}
interface Customer { id: string; name: string; phone: string; line_note?: string | null }

export default function GroupSettingsForm({ groups: initial, customers }: {
  groups: Group[]; customers: Customer[]
}) {
  const [groups, setGroups] = useState<Group[]>(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [form, setForm] = useState({ customer_id: '', group_id: '', group_name: '', khunthong_added: false, auto_send: true })
  const [testResult, setTestResult] = useState<Record<string, string>>({})

  async function addGroup() {
    if (!form.customer_id || !form.group_id) return
    setSaving('add')
    const res = await fetch('/api/line/group-settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.data) {
      const cust = customers.find(c => c.id === form.customer_id)
      setGroups(g => [...g, { ...data.data, customer: cust }])
      setForm({ customer_id: '', group_id: '', group_name: '', khunthong_added: false, auto_send: true })
      setShowAdd(false)
    }
    setSaving(null)
  }

  async function updateGroup(id: string, patch: Partial<Group>) {
    setSaving(id)
    await fetch('/api/line/group-settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }),
    })
    setGroups(g => g.map(x => x.id === id ? { ...x, ...patch } : x))
    setSaving(null)
  }

  async function deleteGroup(id: string) {
    if (!confirm('ลบการตั้งค่า LINE Group นี้?')) return
    await fetch(`/api/line/group-settings?id=${id}`, { method: 'DELETE' })
    setGroups(g => g.filter(x => x.id !== id))
  }

  async function sendTest(groupId: string, id: string) {
    setSaving(id)
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: '✅ ทดสอบการเชื่อมต่อ LINE Group สำเร็จค่ะ! ระบบร้านผ้าม่านพร้อมส่งแจ้งเตือนแล้ว 🪟' }] }),
    })
    setTestResult(r => ({ ...r, [id]: res.ok ? '✅ ส่งสำเร็จ' : '❌ ส่งไม่ได้ ตรวจสอบ Group ID' }))
    setSaving(null)
    setTimeout(() => setTestResult(r => ({ ...r, [id]: '' })), 4000)
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📱 LINE Group ต่อลูกค้า</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          background: '#0F6E56', color: '#fff', padding: '8px 16px',
          borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>+ เพิ่ม Group</button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 14, border: '2px solid #0F6E56' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>เพิ่ม LINE Group ใหม่</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>ลูกค้า *</label>
              <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                <option value="">-- เลือกลูกค้า --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.line_note ? ` 🏷️${c.line_note}` : ''} ({c.phone})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Group ID *</label>
              <input value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}
                placeholder="C1234567890abcdef..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>ชื่อ Group (ไม่บังคับ)</label>
            <input value={form.group_name} onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
              placeholder="เช่น กลุ่มบ้านคุณมานี"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.khunthong_added} onChange={e => setForm(f => ({ ...f, khunthong_added: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#854F0B' }} />
              แอด @ขุนทองแล้ว
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.auto_send} onChange={e => setForm(f => ({ ...f, auto_send: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#0F6E56' }} />
              ส่ง Invoice อัตโนมัติ
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addGroup} disabled={saving === 'add'} style={{
              padding: '9px 18px', background: '#0F6E56', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{saving === 'add' ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button onClick={() => setShowAdd(false)} style={{
              padding: '9px 18px', background: '#F1EFE8', color: '#666',
              border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            }}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Group list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map(g => (
          <div key={g.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {g.group_name || 'ไม่ระบุชื่อ group'}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  👤 {g.customer?.name} · 📱 {g.customer?.phone}
                </div>
                <div style={{ fontSize: 11, color: '#aaa', fontFamily: 'monospace', marginTop: 2 }}>
                  Group ID: {g.group_id}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600,
                    background: g.khunthong_added ? '#FAEEDA' : '#F1EFE8',
                    color: g.khunthong_added ? '#854F0B' : '#888',
                  }}>
                    {g.khunthong_added ? '🏦 ขุนทองอยู่ใน group' : '⬜ ยังไม่มีขุนทอง'}
                  </span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600,
                    background: g.auto_send ? '#E1F5EE' : '#F1EFE8',
                    color: g.auto_send ? '#0F6E56' : '#888',
                  }}>
                    {g.auto_send ? '✅ ส่ง Invoice อัตโนมัติ' : '⏸ ส่งด้วยตนเอง'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => sendTest(g.group_id, g.id)} disabled={saving === g.id}
                  style={{ padding: '6px 12px', background: '#E6F1FB', color: '#185FA5', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  {saving === g.id ? '...' : '🧪 ทดสอบ'}
                </button>
                <button onClick={() => updateGroup(g.id, { khunthong_added: !g.khunthong_added })}
                  style={{ padding: '6px 10px', background: g.khunthong_added ? '#FAEEDA' : '#F1EFE8', color: '#854F0B', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                  🏦 {g.khunthong_added ? 'ปิด' : 'เปิด'}
                </button>
                <button onClick={() => updateGroup(g.id, { auto_send: !g.auto_send })}
                  style={{ padding: '6px 10px', background: g.auto_send ? '#E1F5EE' : '#F1EFE8', color: '#0F6E56', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                  {g.auto_send ? '⏸' : '▶️'}
                </button>
                <button onClick={() => deleteGroup(g.id)}
                  style={{ padding: '6px 10px', background: '#FCEBEB', color: '#A32D2D', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                  🗑
                </button>
              </div>
            </div>
            {testResult[g.id] && (
              <div style={{ marginTop: 8, fontSize: 12, color: testResult[g.id].startsWith('✅') ? '#3B6D11' : '#A32D2D', fontWeight: 600 }}>
                {testResult[g.id]}
              </div>
            )}
          </div>
        ))}
        {groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', background: '#fff', borderRadius: 12, color: '#aaa', fontSize: 13 }}>
            ยังไม่มี LINE Group กดเพิ่มด้านบนค่ะ
          </div>
        )}
      </div>
    </div>
  )
}
