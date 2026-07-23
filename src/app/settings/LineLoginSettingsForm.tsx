'use client'
import { useState, useEffect } from 'react'

interface Status {
  configured: boolean
  client_id_masked: string | null
  client_secret_masked: string | null
  updated_at: string | null
  source: 'database' | 'env' | 'none'
}

export default function LineLoginSettingsForm() {
  const [status, setStatus] = useState<Status | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [callbackUrl, setCallbackUrl] = useState('')

  useEffect(() => {
    fetch('/api/settings/line-login').then(r => r.json()).then(d => setStatus(d.data))
    // ต้องตรงกับ redirect_uri ที่ /api/auth/line ใช้จริงเป๊ะๆ ไม่งั้น LINE จะขึ้น error redirect_uri mismatch
    setCallbackUrl(`${window.location.origin}/api/auth/line/callback`)
  }, [])

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 6000) }

  function copy(text: string) { navigator.clipboard.writeText(text); flash('✅ คัดลอกแล้ว') }

  async function save() {
    if (!clientId.trim() || !clientSecret.trim()) { flash('❌ กรอกให้ครบทั้ง 2 ช่อง', false); return }
    setSaving(true)
    const res = await fetch('/api/settings/line-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      flash('✅ บันทึกแล้ว มีผลทันทีภายใน 30 วินาที ไม่ต้อง redeploy')
      setClientId(''); setClientSecret(''); setShowForm(false)
      fetch('/api/settings/line-login').then(r => r.json()).then(d => setStatus(d.data))
    } else {
      flash(`❌ ${data.error || 'บันทึกไม่สำเร็จ'}`, false)
    }
    setSaving(false)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>🔑 เชื่อมต่อ LINE Login</h2>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>
        ตั้งค่า Channel ID และ Channel Secret ของ LINE Login ที่นี่ได้เลย บันทึกลงฐานข้อมูลโดยตรง
        <strong> ไม่ต้องไปตั้งค่าใน environment variables ของ Vercel และไม่ต้อง redeploy</strong> — มีผลใช้งานได้เลยภายใน ~30 วินาที
      </p>

      <div style={{ background: '#FFF8E8', border: '1px solid #F5D98A', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#7A5B00' }}>
        ⚠️ <strong>ทำไมเปลี่ยนค่าใน Vercel env แล้ว error ทุกครั้ง:</strong> การแก้ environment variable ใน Vercel ต้อง &quot;Redeploy&quot; ใหม่ถึงจะมีผล —
        ถ้าเปลี่ยนค่าแล้วไม่ redeploy ระบบจะยังใช้ Channel ID/Secret ตัวเก่าอยู่ ทำให้ login ไม่ได้ ขึ้น <code>invalid_client</code> ตลอด
        ตั้งค่าที่นี่แทนจะไม่มีปัญหานี้เลย
      </div>

      {status && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, marginBottom: 16,
          background: status.configured ? '#EAF3DE' : '#FFF5F5',
        }}>
          <div style={{ fontSize: 20 }}>{status.configured ? '✅' : '⚠️'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: status.configured ? '#3B6D11' : '#A32D2D' }}>
              {status.configured
                ? `เชื่อมต่อแล้ว (${status.source === 'database' ? 'ตั้งค่าจากหน้านี้' : 'ใช้ค่าจาก environment variable'})`
                : 'ยังไม่ได้เชื่อมต่อ LINE Login'}
            </div>
            {status.configured && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                Channel ID: {status.client_id_masked} · Secret: {status.client_secret_masked}
                {status.updated_at && ` · แก้ไขล่าสุด ${new Date(status.updated_at).toLocaleString('th-TH')}`}
              </div>
            )}
          </div>
          <button onClick={() => setShowForm(s => !s)} style={{
            padding: '6px 14px', background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {status.configured ? 'เปลี่ยนค่า' : 'ตั้งค่าเลย'}
          </button>
        </div>
      )}

      {showForm && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label className="label">Channel ID</label>
            <input value={clientId} onChange={e => setClientId(e.target.value)} className="input"
              placeholder="จาก LINE Developers Console → LINE Login channel → Basic settings → Channel ID" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="label">Channel Secret</label>
            <input value={clientSecret} onChange={e => setClientSecret(e.target.value)} className="input"
              placeholder="จาก LINE Developers Console → LINE Login channel → Basic settings → Channel secret" />
          </div>
          <button onClick={save} disabled={saving} style={{
            padding: '10px 18px', background: '#0F6E56', color: '#fff', border: 'none',
            borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกและเชื่อมต่อ'}
          </button>
        </div>
      )}

      {msg && <div style={{ marginTop: 12, fontSize: 13, color: msg.ok ? '#0F6E56' : '#A32D2D' }}>{msg.text}</div>}

      <div style={{ marginTop: 16, background: '#F8F9FA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#666' }}>
        💡 หา Channel ID/Secret ได้จาก <a href="https://developers.line.biz" target="_blank" rel="noreferrer" style={{ color: '#185FA5' }}>LINE Developers Console</a> →
        เลือก <strong>LINE Login channel</strong> ของร้าน (คนละตัวกับ Messaging API channel) → แท็บ Basic settings
      </div>

      <div style={{ marginTop: 10, background: '#F8F9FA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#666' }}>
        📍 <strong>สำคัญ:</strong> ต้องเอา URL นี้ไปวางในแท็บ <strong>LINE Login</strong> ของ Channel เดียวกัน ช่อง <strong>Callback URL</strong> ให้ตรงเป๊ะ ไม่งั้นจะ error <code>redirect_uri mismatch</code>:
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <code style={{ background: '#fff', padding: '4px 8px', borderRadius: 4, flex: 1, wordBreak: 'break-all', fontSize: 11 }}>{callbackUrl}</code>
          <button onClick={() => copy(callbackUrl)} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}>📋 คัดลอก</button>
        </div>
      </div>
    </div>
  )
}
