'use client'
import { useState, useEffect } from 'react'

interface Status {
  configured: boolean
  channel_access_token_masked: string | null
  channel_secret_masked: string | null
  updated_at: string | null
  source: 'database' | 'env' | 'none'
}

export default function LineOASettingsForm() {
  const [status, setStatus] = useState<Status | null>(null)
  const [token, setToken] = useState('')
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetch('/api/settings/line-oa').then(r => r.json()).then(d => setStatus(d.data))
  }, [])

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000) }

  async function save() {
    if (!token.trim() || !secret.trim()) { flash('❌ กรอกให้ครบทั้ง 2 ช่อง', false); return }
    setSaving(true)
    const res = await fetch('/api/settings/line-oa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_access_token: token.trim(), channel_secret: secret.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      flash('✅ บันทึกและเชื่อมต่อ LINE OA แล้ว ใช้งานได้ทันที')
      setToken(''); setSecret(''); setShowForm(false)
      fetch('/api/settings/line-oa').then(r => r.json()).then(d => setStatus(d.data))
    } else {
      flash(`❌ ${data.error || 'บันทึกไม่สำเร็จ'}`, false)
    }
    setSaving(false)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>🔌 เชื่อมต่อ LINE OA</h2>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>
        ตั้งค่า Channel Access Token และ Channel Secret ของ LINE Official Account ที่นี่ได้เลย
        บันทึกลงฐานข้อมูลโดยตรง <strong>ไม่ต้องไปตั้งค่าใน environment variables</strong> ของ Vercel — ใช้งานได้ทันทีหลังบันทึก
      </p>

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
                : 'ยังไม่ได้เชื่อมต่อ LINE OA'}
            </div>
            {status.configured && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                Token: {status.channel_access_token_masked} · Secret: {status.channel_secret_masked}
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
            <label className="label">Channel Access Token (Long-lived)</label>
            <input value={token} onChange={e => setToken(e.target.value)} className="input"
              placeholder="จาก LINE Developers Console → Messaging API → Channel access token" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="label">Channel Secret</label>
            <input value={secret} onChange={e => setSecret(e.target.value)} className="input"
              placeholder="จาก LINE Developers Console → Basic settings → Channel secret" />
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
        💡 หา 2 ค่านี้ได้จาก <a href="https://developers.line.biz" target="_blank" rel="noreferrer" style={{ color: '#185FA5' }}>LINE Developers Console</a> →
        เลือก Messaging API channel ของร้าน → Channel access token กด &quot;Issue&quot; ถ้ายังไม่มี, Channel secret อยู่ในแท็บ Basic settings
      </div>
    </div>
  )
}
