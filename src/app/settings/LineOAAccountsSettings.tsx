'use client'
import { useState, useEffect } from 'react'

interface OAAccount {
  id: string
  name: string
  is_default: boolean
  active: boolean
  channel_access_token_masked: string | null
  channel_secret_masked: string | null
  updated_at?: string
}

export default function LineOAAccountsSettings() {
  const [accounts, setAccounts] = useState<OAAccount[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', channel_access_token: '', channel_secret: '', is_default: false })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; channel_access_token: string; channel_secret: string }>({ name: '', channel_access_token: '', channel_secret: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000) }

  useEffect(() => { reload() }, [])

  async function reload() {
    const r = await fetch('/api/settings/line-oa-accounts')
    const d = await r.json()
    if (d.data) setAccounts(d.data)
  }

  async function addAccount() {
    if (!form.name.trim() || !form.channel_access_token.trim() || !form.channel_secret.trim()) {
      flash('❌ กรอกให้ครบทุกช่อง', false); return
    }
    setSaving(true)
    const res = await fetch('/api/settings/line-oa-accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        channel_access_token: form.channel_access_token.trim(),
        channel_secret: form.channel_secret.trim(),
        is_default: form.is_default,
      }),
    })
    const data = await res.json()
    if (data.data) {
      setForm({ name: '', channel_access_token: '', channel_secret: '', is_default: false })
      setShowAdd(false)
      flash('✅ เพิ่มบัญชี OA แล้ว ใช้งานได้ทันที')
      await reload()
    } else flash('❌ ' + data.error, false)
    setSaving(false)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const body: Record<string, string> = { name: editForm.name }
    if (editForm.channel_access_token.trim()) body.channel_access_token = editForm.channel_access_token.trim()
    if (editForm.channel_secret.trim()) body.channel_secret = editForm.channel_secret.trim()
    const res = await fetch(`/api/settings/line-oa-accounts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.data) { setEditId(null); flash('✅ บันทึกแล้ว'); await reload() }
    else flash('❌ ' + data.error, false)
    setSaving(false)
  }

  async function setDefault(id: string) {
    setSaving(true)
    const res = await fetch(`/api/settings/line-oa-accounts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_default: true }),
    })
    if (res.ok) { flash('✅ ตั้งเป็นบัญชีหลักแล้ว'); await reload() }
    setSaving(false)
  }

  async function toggleActive(id: string, active: boolean) {
    setSaving(true)
    const res = await fetch(`/api/settings/line-oa-accounts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }),
    })
    if (res.ok) await reload()
    setSaving(false)
  }

  async function deleteAccount(id: string, name: string) {
    if (!confirm(`ลบบัญชี "${name}"? กลุ่ม/ผู้ติดต่อที่ผูกกับบัญชีนี้จะกลับไปใช้บัญชี default แทน`)) return
    setSaving(true)
    const res = await fetch(`/api/settings/line-oa-accounts/${id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) { flash('✅ ลบแล้ว'); await reload() }
    else flash('❌ ' + (data.error || 'ลบไม่สำเร็จ'), false)
    setSaving(false)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>📡 บัญชี LINE OA หลายบัญชี (Multi-OA)</h2>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>
        เพิ่มบัญชี LINE Official Account ได้หลายตัว (เช่น xxxx, xxxx — แต่ละตัวมี Token/Secret ของตัวเอง)
        แล้วไปเลือกที่หน้า &quot;กลุ่ม LINE&quot; ด้านล่างว่ากลุ่มไหนจะส่งผ่าน OA ตัวไหน — ถ้าไม่เลือก ระบบจะใช้บัญชี <strong>default</strong> อัตโนมัติ
      </p>

      {msg && (
        <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>{msg.text}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setShowAdd(s => !s)} className="btn btn-primary">
          {showAdd ? 'ยกเลิก' : '+ เพิ่มบัญชี OA'}
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ padding: 20, marginBottom: 16, border: '2px solid var(--brand)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>เพิ่มบัญชี LINE OA ใหม่</div>
          <div style={{ marginBottom: 12 }}>
            <label className="label">ชื่อบัญชี (จำง่ายๆ) *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input" placeholder="เช่น xxxx" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="label">Channel Access Token (Long-lived) *</label>
            <input value={form.channel_access_token} onChange={e => setForm(f => ({ ...f, channel_access_token: e.target.value }))}
              className="input" placeholder="จาก LINE Developers Console → Messaging API → Channel access token" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="label">Channel Secret *</label>
            <input value={form.channel_secret} onChange={e => setForm(f => ({ ...f, channel_secret: e.target.value }))}
              className="input" placeholder="จาก LINE Developers Console → Basic settings → Channel secret" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
            ตั้งเป็นบัญชี default (ใช้กับทุกอย่างที่ยังไม่ได้เลือกบัญชีเจาะจง)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addAccount} disabled={saving} className="btn btn-primary">
              {saving ? 'กำลังบันทึก...' : '✅ เพิ่มบัญชี'}
            </button>
            <button onClick={() => setShowAdd(false)} className="btn btn-ghost">ยกเลิก</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {accounts.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            ยังไม่มีบัญชี OA — กด &quot;+ เพิ่มบัญชี OA&quot; ด้านบน
          </div>
        ) : accounts.map(a => (
          <div key={a.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
            {editId === a.id ? (
              <div style={{ padding: '12px 16px', background: 'var(--brand-lt)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label className="label">ชื่อบัญชี</label>
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="input" style={{ fontSize: 12 }} />
                  </div>
                  <div>
                    <label className="label">Channel Access Token (เว้นว่างถ้าไม่เปลี่ยน)</label>
                    <input value={editForm.channel_access_token} onChange={e => setEditForm(f => ({ ...f, channel_access_token: e.target.value }))} className="input" style={{ fontSize: 12 }} placeholder="●●●●●●●● (ไม่เปลี่ยน)" />
                  </div>
                  <div>
                    <label className="label">Channel Secret (เว้นว่างถ้าไม่เปลี่ยน)</label>
                    <input value={editForm.channel_secret} onChange={e => setEditForm(f => ({ ...f, channel_secret: e.target.value }))} className="input" style={{ fontSize: 12 }} placeholder="●●●●●●●● (ไม่เปลี่ยน)" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => saveEdit(a.id)} disabled={saving} className="btn btn-primary" style={{ fontSize: 11, padding: '5px 12px' }}>💾 บันทึก</button>
                  <button onClick={() => setEditId(null)} className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }}>ยกเลิก</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: a.active ? 'var(--dark)' : 'var(--text-muted)' }}>{a.name}</span>
                    {a.is_default && <span className="badge badge-gray" style={{ fontSize: 9, background: 'var(--brand-lt)', color: 'var(--brand)' }}>⭐ Default</span>}
                    {!a.active && <span className="badge badge-gray" style={{ fontSize: 9 }}>ปิดใช้</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Token: <code style={{ background: 'var(--gray)', padding: '1px 5px', borderRadius: 3 }}>{a.channel_access_token_masked}</code>
                    {' · '}Secret: <code style={{ background: 'var(--gray)', padding: '1px 5px', borderRadius: 3 }}>{a.channel_secret_masked}</code>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Webhook URL: <code style={{ background: 'var(--gray)', padding: '1px 5px', borderRadius: 3 }}>/api/line/webhook/{a.id}</code>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {!a.is_default && (
                    <button onClick={() => setDefault(a.id)} disabled={saving} className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 9px' }}>⭐ ตั้ง default</button>
                  )}
                  <button onClick={() => { setEditId(a.id); setEditForm({ name: a.name, channel_access_token: '', channel_secret: '' }) }}
                    className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 9px' }}>✏️</button>
                  <button onClick={() => toggleActive(a.id, !a.active)} disabled={saving}
                    className={`btn ${a.active ? 'btn-ghost' : 'btn-secondary'}`} style={{ fontSize: 11, padding: '4px 9px' }}>
                    {a.active ? '⏸ ปิด' : '▶ เปิด'}
                  </button>
                  {!a.is_default && (
                    <button onClick={() => deleteAccount(a.id, a.name)} disabled={saving} className="btn btn-danger" style={{ fontSize: 11, padding: '4px 9px' }}>🗑</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, background: '#F8F9FA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#666' }}>
        💡 แต่ละบัญชีต้องตั้ง Webhook URL แยกกันใน LINE Developers Console ของ Channel นั้นๆ เป็น:<br />
        <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 4 }}>https://โดเมนเว็บคุณ/api/line/webhook/[id ของบัญชีนี้]</code><br />
        (บัญชี default ยังใช้ URL เดิม <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 4 }}>/api/line/webhook</code> ได้ตามปกติ ไม่ต้องเปลี่ยน)
      </div>
    </div>
  )
}
