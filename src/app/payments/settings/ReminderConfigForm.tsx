'use client'
import { useState } from 'react'

interface Config { id: string; name: string; days_after: number; message_tpl: string; active: boolean }

export default function ReminderConfigForm({ configs: initial }: { configs: Config[] }) {
  const [configs, setConfigs] = useState<Config[]>(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const VARS = ['{customer_name}', '{invoice_no}', '{amount}', '{due_date}', '{days_overdue}']

  async function save(cfg: Config) {
    setSaving(true)
    const res = await fetch('/api/payments/reminder-config', {
      method: cfg.id.startsWith('new') ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
    const data = await res.json()
    if (data.data) {
      setConfigs(c => c.map(x => x.id === cfg.id ? data.data : x))
      setMsg('✅ บันทึกแล้ว')
      setEditing(null)
    }
    setSaving(false)
  }

  async function toggle(id: string, active: boolean) {
    setConfigs(c => c.map(x => x.id === id ? { ...x, active } : x))
    await fetch('/api/payments/reminder-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active }),
    })
  }

  function addNew() {
    const newCfg: Config = { id: `new_${Date.now()}`, name: 'แจ้งเตือนใหม่', days_after: 2, message_tpl: 'คุณ{customer_name} Invoice {invoice_no} ค้างชำระ {amount} บาท', active: true }
    setConfigs(c => [...c, newCfg])
    setEditing(newCfg.id)
  }

  return (
    <div>
      {/* Variable reference */}
      <div style={{ background: '#E6F1FB', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#185FA5', marginBottom: 6 }}>📖 ตัวแปรที่ใช้ได้ในข้อความ</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {VARS.map(v => (
            <code key={v} style={{ background: '#fff', border: '1px solid #c0d8f0', borderRadius: 6, padding: '2px 8px', fontSize: 12, color: '#185FA5' }}>{v}</code>
          ))}
        </div>
      </div>

      {/* Config list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {configs.map(cfg => (
          <div key={cfg.id} style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: editing === cfg.id ? '2px solid #0F6E56' : '2px solid transparent' }}>
            {editing === cfg.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>ชื่อรายการ</label>
                    <input value={cfg.name} onChange={e => setConfigs(c => c.map(x => x.id === cfg.id ? { ...x, name: e.target.value } : x))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>หลังครบกำหนด (วัน) — 0 = วันนั้น</label>
                    <input type="number" value={cfg.days_after} onChange={e => setConfigs(c => c.map(x => x.id === cfg.id ? { ...x, days_after: Number(e.target.value) } : x))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>ข้อความแจ้งเตือน</label>
                  <textarea value={cfg.message_tpl} rows={3} onChange={e => setConfigs(c => c.map(x => x.id === cfg.id ? { ...x, message_tpl: e.target.value } : x))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => save(cfg)} disabled={saving} style={{ padding: '8px 16px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                    {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                  <button onClick={() => setEditing(null)} style={{ padding: '8px 16px', background: '#F1EFE8', color: '#666', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 24, background: cfg.active ? '#E1F5EE' : '#F1EFE8', borderRadius: 8, padding: '6px 10px' }}>
                  {cfg.active ? '🔔' : '🔕'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{cfg.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {cfg.days_after === 0 ? '📅 วันครบกำหนด' : `📅 หลังครบกำหนด ${cfg.days_after} วัน`}
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 2, fontStyle: 'italic', maxWidth: 400 }}>{cfg.message_tpl}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={cfg.active} onChange={e => toggle(cfg.id, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#0F6E56' }} />
                    {cfg.active ? 'เปิด' : 'ปิด'}
                  </label>
                  <button onClick={() => setEditing(cfg.id)} style={{ padding: '6px 12px', background: '#E6F1FB', color: '#185FA5', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    แก้ไข
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={addNew} style={{ width: '100%', padding: '12px', background: '#F1EFE8', color: '#0F6E56', border: '2px dashed #0F6E56', borderRadius: 12, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
        + เพิ่มรายการแจ้งเตือน
      </button>

      {msg && <div style={{ marginTop: 12, fontSize: 13, color: '#3B6D11' }}>{msg}</div>}
    </div>
  )
}
