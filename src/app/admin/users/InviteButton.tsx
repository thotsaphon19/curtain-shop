'use client'
import { useState } from 'react'

export default function InviteButton() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<'technician' | 'customer' | 'viewer'>('technician')
  const [note, setNote] = useState('')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true)
    const res = await fetch('/api/admin/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, note }),
    })
    const data = await res.json()
    if (data.invite_url) setLink(data.invite_url)
    setLoading(false)
  }

  async function copy() {
    await navigator.clipboard.writeText(link)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="btn btn-secondary">
      🔗 เชิญผู้ใช้
    </button>
  )

  return (
    <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }} />
      <div className="overlay" style={{ zIndex: 101 }}>
        <div className="modal" style={{ maxWidth: 420 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🔗 สร้างลิงค์เชิญ</h3>

          <div style={{ marginBottom: 12 }}>
            <label className="label">Role สำหรับผู้ถูกเชิญ</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['technician', 'customer', 'viewer'] as const).map(r => (
                <button key={r} onClick={() => setRole(r)} style={{
                  flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${role === r ? 'var(--brand)' : 'var(--border)'}`,
                  background: role === r ? 'var(--brand-lt)' : 'var(--white)', fontSize: 12, fontWeight: 600,
                  color: role === r ? 'var(--brand)' : 'var(--text-muted)', cursor: 'pointer',
                }}>
                  {r === 'technician' ? '👷 ช่าง' : r === 'customer' ? '👤 ลูกค้า' : '👁 Viewer'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="label">หมายเหตุ (ไม่บังคับ)</label>
            <input value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="เช่น ช่างสมชาย" />
          </div>

          {!link ? (
            <button onClick={generate} disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? '⏳ กำลังสร้าง...' : '✨ สร้างลิงค์เชิญ'}
            </button>
          ) : (
            <div>
              <div style={{ background: 'var(--gray)', borderRadius: 8, padding: '10px 12px', fontSize: 12, wordBreak: 'break-all', marginBottom: 10, fontFamily: 'monospace' }}>
                {link}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copy} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {copied ? '✅ คัดลอกแล้ว!' : '📋 คัดลอกลิงค์'}
                </button>
                <button onClick={() => setLink('')} className="btn btn-ghost">สร้างใหม่</button>
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 8, textAlign: 'center' }}>ลิงค์จะหมดอายุใน 7 วัน · ใช้ได้ 1 ครั้ง</div>
            </div>
          )}

          <button onClick={() => { setOpen(false); setLink('') }} style={{ marginTop: 12, width: '100%', padding: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>ปิด</button>
        </div>
      </div>
    </>
  )
}
