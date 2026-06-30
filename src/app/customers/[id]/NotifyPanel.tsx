'use client'
import { useState } from 'react'

interface UnpaidInvoice { id: string; invoice_no: string; remain: number; status: string }

interface Props {
  customerId: string
  customerName: string
  customerLineId?: string
  hasGroup: boolean
  groupId?: string
  groupName?: string
  khunthongAdded: boolean
  unpaidInvoices: UnpaidInvoice[]
}

type Channel = 'dm' | 'group' | 'khunthong' | 'all'

const CHANNEL_CONFIG = {
  dm:         { icon: '💬', label: 'LINE DM', desc: 'ส่งตรงถึงลูกค้า', color: '#0F6E56', bg: '#E1F5EE', needLineId: true,  needGroup: false, needKhunthong: false },
  group:      { icon: '👥', label: 'LINE Group', desc: 'ส่งเข้า group',  color: '#185FA5', bg: '#E6F1FB', needLineId: false, needGroup: true,  needKhunthong: false },
  khunthong:  { icon: '🏦', label: 'ขุนทอง',    desc: 'ให้ขุนทองทวง',  color: '#854F0B', bg: '#FAEEDA', needLineId: false, needGroup: true,  needKhunthong: true },
  all:        { icon: '📣', label: 'ทุกช่องทาง', desc: 'DM + Group + ขุนทอง', color: '#534AB7', bg: '#EEEDFE', needLineId: false, needGroup: false, needKhunthong: false },
}

export default function NotifyPanel({
  customerId, customerName, customerLineId,
  hasGroup, groupId, groupName, khunthongAdded,
  unpaidInvoices,
}: Props) {
  const [selectedChannel, setSelectedChannel] = useState<Channel>('all')
  const [selectedInvoice, setSelectedInvoice] = useState<string>(unpaidInvoices[0]?.id || '')
  const [customMsg, setCustomMsg] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; channels: string[]; error?: string } | null>(null)
  const [history, setHistory] = useState<{ ts: string; channel: string; label: string; success: boolean }[]>([])

  function canUseChannel(ch: Channel): boolean {
    const cfg = CHANNEL_CONFIG[ch]
    if (cfg.needLineId && !customerLineId) return false
    if (cfg.needGroup && !hasGroup) return false
    if (cfg.needKhunthong && !khunthongAdded) return false
    return true
  }

  async function send() {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/line/notify-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          invoice_id: selectedInvoice || undefined,
          channel: selectedChannel,
          custom_message: useCustom && customMsg ? customMsg : undefined,
        }),
      })
      const data = await res.json()
      setResult({ success: data.success, channels: data.channels_used || [], error: data.error })
      if (data.success) {
        setHistory(h => [{
          ts: new Date().toLocaleTimeString('th-TH'),
          channel: selectedChannel,
          label: CHANNEL_CONFIG[selectedChannel].label,
          success: true,
        }, ...h].slice(0, 10))
      }
    } catch {
      setResult({ success: false, channels: [], error: 'เกิดข้อผิดพลาด' })
    }
    setSending(false)
  }

  const availableChannels = (Object.keys(CHANNEL_CONFIG) as Channel[]).filter(ch => {
    if (ch === 'all') return true
    return canUseChannel(ch)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Status bar */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#0F2027' }}>สถานะการเชื่อมต่อ</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { icon: '💬', label: 'LINE DM', ok: !!customerLineId, detail: customerLineId ? `ID: ${customerLineId.slice(0, 10)}...` : 'ยังไม่ผูก LINE ID' },
            { icon: '👥', label: 'LINE Group', ok: hasGroup, detail: hasGroup ? (groupName || groupId?.slice(0, 14) + '...') : 'ยังไม่ตั้งค่า' },
            { icon: '🏦', label: 'ขุนทอง', ok: khunthongAdded, detail: khunthongAdded ? 'อยู่ใน group แล้ว' : 'ยังไม่ได้แอด' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: 11, color: '#888', marginLeft: 6 }}>{s.detail}</span>
              </div>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 700,
                background: s.ok ? '#E1F5EE' : '#F1EFE8',
                color: s.ok ? '#0F6E56' : '#aaa',
              }}>{s.ok ? '✅ พร้อม' : '⬜ ไม่พร้อม'}</span>
            </div>
          ))}
        </div>
        {(!customerLineId || !hasGroup) && (
          <a href="/settings" style={{ display: 'block', marginTop: 10, fontSize: 12, color: '#185FA5', textDecoration: 'none' }}>
            ⚙️ ตั้งค่าช่องทางแจ้งเตือน →
          </a>
        )}
      </div>

      {/* Notify form */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px', color: '#0F2027' }}>
          📣 แจ้งเตือน คุณ{customerName}
        </h3>

        {/* Channel select */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>ช่องทาง</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(Object.keys(CHANNEL_CONFIG) as Channel[]).map(ch => {
              const cfg = CHANNEL_CONFIG[ch]
              const available = canUseChannel(ch) || ch === 'all'
              const active = selectedChannel === ch
              return (
                <button key={ch} onClick={() => available && setSelectedChannel(ch)}
                  disabled={!available}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 12px', borderRadius: 10, border: `2px solid ${active ? cfg.color : '#eee'}`,
                    background: active ? cfg.bg : '#fff',
                    cursor: available ? 'pointer' : 'not-allowed',
                    opacity: available ? 1 : 0.4, textAlign: 'left',
                  }}>
                  <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? cfg.color : '#333' }}>{cfg.label}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>{cfg.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Invoice select */}
        {unpaidInvoices.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Invoice ที่แจ้ง</div>
            <select value={selectedInvoice} onChange={e => setSelectedInvoice(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
              <option value="">ล่าสุดที่ค้างชำระ</option>
              {unpaidInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_no} — ค้าง ฿{inv.remain.toLocaleString()}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Custom message toggle */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={useCustom} onChange={e => setUseCustom(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#0F6E56' }} />
            ปรับข้อความเอง
          </label>
          {useCustom && (
            <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)}
              placeholder={`สวัสดีค่ะ คุณ${customerName}...`}
              rows={4}
              style={{
                width: '100%', marginTop: 8, padding: '10px 12px', borderRadius: 8,
                border: '1px solid #ddd', fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
              }} />
          )}
        </div>

        {/* Preview */}
        {selectedChannel && (
          <div style={{ marginBottom: 14, padding: '10px 12px', background: '#F8F9FA', borderRadius: 8, fontSize: 12, color: '#555' }}>
            <strong style={{ color: '#333' }}>จะส่งผ่าน:</strong>{' '}
            {selectedChannel === 'all'
              ? [customerLineId && '💬 LINE DM', hasGroup && '👥 Group', khunthongAdded && '🏦 ขุนทอง'].filter(Boolean).join(' + ')
              : `${CHANNEL_CONFIG[selectedChannel].icon} ${CHANNEL_CONFIG[selectedChannel].label}`
            }
          </div>
        )}

        {/* Send button */}
        <button onClick={send} disabled={sending || availableChannels.length === 0}
          style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: sending ? '#aaa' : '#0F2027',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: sending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          {sending ? (
            <>⏳ กำลังส่ง...</>
          ) : (
            <>{CHANNEL_CONFIG[selectedChannel]?.icon} ส่งแจ้งเตือน คุณ{customerName}</>
          )}
        </button>

        {/* Result */}
        {result && (
          <div style={{
            marginTop: 12, padding: '12px 14px', borderRadius: 10,
            background: result.success ? '#E1F5EE' : '#FCEBEB',
            border: `1px solid ${result.success ? '#5DCAA5' : '#F09595'}`,
          }}>
            {result.success ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F6E56', marginBottom: 4 }}>
                  ✅ ส่งสำเร็จแล้วค่ะ!
                </div>
                <div style={{ fontSize: 12, color: '#555' }}>
                  ช่องทางที่ส่ง: {result.channels.map(ch => {
                    const cfg = CHANNEL_CONFIG[ch as Channel]
                    return cfg ? `${cfg.icon} ${cfg.label}` : ch
                  }).join(', ')}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#A32D2D', fontWeight: 600 }}>
                ❌ ส่งไม่สำเร็จ: {result.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notify history */}
      {history.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: '#888' }}>📝 ประวัติการแจ้งเตือน (session นี้)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: '#aaa', minWidth: 52 }}>{h.ts}</span>
                <span>{CHANNEL_CONFIG[h.channel as Channel]?.icon || '📣'}</span>
                <span style={{ color: '#555', flex: 1 }}>{h.label}</span>
                <span style={{ color: '#3B6D11', fontWeight: 700 }}>✅</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: '#888' }}>การดำเนินการอื่น</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a href={`/invoices/new?customer_id=${customerId}`} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8,
            background: '#E6F1FB', color: '#185FA5', textDecoration: 'none', fontSize: 13, fontWeight: 600,
          }}>💳 สร้าง Invoice ใหม่</a>
          <a href={`/jobs/new?customer_id=${customerId}`} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8,
            background: '#E1F5EE', color: '#0F6E56', textDecoration: 'none', fontSize: 13, fontWeight: 600,
          }}>🔧 สร้างงานใหม่</a>
          <a href={`/settings?customer_id=${customerId}`} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8,
            background: '#FAEEDA', color: '#854F0B', textDecoration: 'none', fontSize: 13, fontWeight: 600,
          }}>🏦 ตั้งค่า LINE Group + ขุนทอง</a>
        </div>
      </div>
    </div>
  )
}
