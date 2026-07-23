'use client'
import { useState, useEffect, useCallback } from 'react'

interface OAAccount { id: string; name: string; is_default: boolean; active: boolean }

const DEFAULT_MESSAGE = '📢 ประกาศเปลี่ยนช่องทาง LINE ใหม่\n\nร้านได้เปลี่ยนบัญชี LINE อย่างเป็นทางการค่ะ กรุณาแอดเพื่อนช่องทางใหม่ด้านล่างนี้ เพื่อให้ยังคงได้รับแจ้งเตือนงาน/นัดหมายต่อเนื่องนะคะ 🙏\n\n(ช่องทางเดิมนี้จะปิดการแจ้งเตือนในเร็วๆ นี้)'

export default function OAMigrationSettings() {
  const [open, setOpen] = useState(false)
  const [oaAccounts, setOaAccounts] = useState<OAAccount[]>([])
  const [fromOaId, setFromOaId] = useState('')
  const [newOaUrl, setNewOaUrl] = useState('')
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [includeCustomers, setIncludeCustomers] = useState(true)
  const [includeTechnicians, setIncludeTechnicians] = useState(true)
  const [preview, setPreview] = useState<{ customers: number; technicians: number } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ total: number; sent: number; failed: number } | null>(null)
  const [error, setError] = useState('')

  const loadPreview = useCallback(async (oaId: string) => {
    setLoadingPreview(true)
    const params = new URLSearchParams()
    if (oaId) params.set('from_oa_account_id', oaId)
    const r = await fetch(`/api/settings/line-oa-migration?${params}`)
    const d = await r.json()
    setOaAccounts(d.oa_accounts || [])
    setPreview(d.preview || null)
    if (!oaId && d.oa_accounts?.length > 0) {
      const def = d.oa_accounts.find((a: OAAccount) => a.is_default) || d.oa_accounts[0]
      setFromOaId(def.id)
    }
    setLoadingPreview(false)
  }, [])

  useEffect(() => { if (open) loadPreview(fromOaId) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && fromOaId) loadPreview(fromOaId) }, [fromOaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const recipientCount = (includeCustomers ? preview?.customers || 0 : 0) + (includeTechnicians ? preview?.technicians || 0 : 0)

  async function send() {
    setSending(true); setError(''); setResult(null)
    try {
      const r = await fetch('/api/settings/line-oa-migration', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_oa_account_id: fromOaId, new_oa_url: newOaUrl.trim(), message,
          include_customers: includeCustomers, include_technicians: includeTechnicians,
        }),
      })
      const d = await r.json()
      if (!r.ok) setError(d.error || 'ส่งไม่สำเร็จ')
      else setResult(d)
    } catch { setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง') }
    setSending(false)
    setConfirming(false)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>📣 ย้ายลูกค้า/ช่างไป OA ใหม่</h2>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 14px' }}>
        LINE ไม่มีทางโอน &ldquo;ความเป็นเพื่อน&rdquo; จาก OA เก่าไป OA ใหม่ให้อัตโนมัติได้ — สิ่งที่ทำได้คือ
        <strong> ส่งข้อความเชิญชวนให้ทุกคนที่ยังผูก LINE กับระบบอยู่ (ผ่าน OA เดิม) แอดเพื่อน OA ใหม่พร้อมกันทีเดียว</strong>
        หลังจากนั้นต้องรอให้แต่ละคนกดแอดเพื่อนเอง แล้วแอดมินไปผูก userId ใหม่ที่หัวข้อ
        &ldquo;คนที่เคยทัก LINE OA เข้ามา&rdquo; ด้านบนอีกที
      </p>

      {!open ? (
        <button onClick={() => setOpen(true)} className="btn btn-secondary" style={{ fontSize: 13 }}>
          📣 เปิดเครื่องมือส่งคำเชิญย้าย OA
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">ส่งจากบัญชี OA เดิม (บัญชีที่ลูกค้า/ช่างยังเป็นเพื่อนอยู่)</label>
            <select value={fromOaId} onChange={e => setFromOaId(e.target.value)} className="select">
              <option value="">-- เลือกบัญชี --</option>
              {oaAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}{a.is_default ? ' (default)' : ''}{!a.active ? ' — ปิดใช้งานอยู่' : ''}</option>
              ))}
            </select>
            {oaAccounts.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
                ยังไม่มีบัญชี OA ในระบบ — ถ้า OA เก่ายังใช้ส่งไม่ได้ ให้ไปเพิ่ม Token/Secret ของบัญชีเก่ากลับเข้าไปที่หัวข้อ &ldquo;บัญชี LINE OA หลายบัญชี&rdquo; ด้านบนก่อน (ตั้งเป็น active แต่ไม่ต้องเป็น default)
              </div>
            )}
          </div>

          <div>
            <label className="label">ลิงก์แอดเพื่อน OA ใหม่ (เช่น https://lin.ee/xxxxxxx)</label>
            <input value={newOaUrl} onChange={e => setNewOaUrl(e.target.value)} className="input" placeholder="https://lin.ee/xxxxxxx" />
          </div>

          <div>
            <label className="label">ข้อความ (ระบบจะแนบลิงก์ต่อท้ายให้อัตโนมัติ)</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} className="textarea" rows={5} />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={includeCustomers} onChange={e => setIncludeCustomers(e.target.checked)} />
              ส่งให้ลูกค้า {preview && `(${preview.customers} คนที่ผูก LINE อยู่)`}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={includeTechnicians} onChange={e => setIncludeTechnicians(e.target.checked)} />
              ส่งให้ช่าง {preview && `(${preview.technicians} คนที่ผูก LINE อยู่)`}
            </label>
          </div>

          {loadingPreview && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>กำลังนับจำนวนผู้รับ...</div>}

          {error && <div className="alert alert-error">❌ {error}</div>}

          {result && (
            <div className="alert alert-success">
              ✅ ส่งแล้ว {result.total} คน — สำเร็จ {result.sent} / ไม่สำเร็จ {result.failed}
              {result.failed > 0 && ' (คนที่ไม่สำเร็จส่วนใหญ่คือยังไม่ได้แอดเพื่อน OA เดิมนี้แล้ว หรือ token หมดอายุ)'}
            </div>
          )}

          {!confirming ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirming(true)}
                disabled={!fromOaId || !newOaUrl.trim() || recipientCount === 0 || sending}
                className="btn btn-primary"
              >
                ส่งคำเชิญให้ {recipientCount} คน
              </button>
              <button onClick={() => setOpen(false)} className="btn btn-ghost">ปิด</button>
            </div>
          ) : (
            <div className="alert alert-warning" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>⚠️ ยืนยันส่งข้อความจริงหา {recipientCount} คนเลยหรือไม่? กดแล้วส่งทันที ยกเลิกไม่ได้</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={send} disabled={sending} className="btn btn-danger">
                  {sending ? 'กำลังส่ง...' : `ยืนยัน ส่งเลย (${recipientCount} คน)`}
                </button>
                <button onClick={() => setConfirming(false)} disabled={sending} className="btn btn-ghost">ยกเลิก</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
