'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Customer { id: string; name: string; phone: string; line_note?: string | null }
interface JobOpt { id: string; title: string; customer_id: string }
interface Item { id?: string; description: string; unit: string; qty: number; unit_price: number }
interface Quotation {
  id: string; quotation_no: string; customer_id: string; job_id?: string
  status: string; discount: number; vat_pct: number; notes?: string
  valid_until?: string; quotation_items?: Item[]
  customer?: { name: string; phone: string; address: string }
}

const STATUS_OPTS = [
  { value: 'draft',    label: '📝 ร่าง' },
  { value: 'sent',     label: '📤 ส่งแล้ว' },
  { value: 'approved', label: '✅ อนุมัติ' },
  { value: 'rejected', label: '❌ ปฏิเสธ' },
]

const UNIT_OPTS = ['ตร.ม.', 'ม.', 'ชิ้น', 'ชุด', 'คู่', 'อัน', 'ผืน', 'งาน']

const ITEM_TEMPLATES = [
  { description: 'ผ้าม่านพับ', unit: 'ตร.ม.', qty: 1, unit_price: 0 },
  { description: 'ผ้าม่านลอน', unit: 'ตร.ม.', qty: 1, unit_price: 0 },
  { description: 'ผ้าม่านม้วน', unit: 'ตร.ม.', qty: 1, unit_price: 0 },
  { description: 'ค่าแรงติดตั้ง', unit: 'งาน', qty: 1, unit_price: 0 },
  { description: 'ราวผ้าม่าน', unit: 'เส้น', qty: 1, unit_price: 0 },
  { description: 'อื่นๆ', unit: 'ชิ้น', qty: 1, unit_price: 0 },
]

export default function QuotationForm({ customers, jobs, mode, quotation }: {
  customers: Customer[]; jobs: JobOpt[]
  mode: 'new' | 'edit'; quotation?: Quotation
}) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState(quotation?.customer_id || '')
  const [jobId, setJobId] = useState(quotation?.job_id || '')
  const [status, setStatus] = useState(quotation?.status || 'draft')
  const [discount, setDiscount] = useState(quotation?.discount || 0)
  const [vatPct, setVatPct] = useState(quotation?.vat_pct ?? 7)
  const [notes, setNotes] = useState(quotation?.notes || '')
  const [validUntil, setValidUntil] = useState(quotation?.valid_until || '')
  const [items, setItems] = useState<Item[]>(
    quotation?.quotation_items?.length
      ? quotation.quotation_items
      : [{ description: '', unit: 'ตร.ม.', qty: 1, unit_price: 0 }]
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // คำนวณ
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) * Number(i.unit_price)), 0)
  const afterDiscount = subtotal - Number(discount)
  const vatAmt = afterDiscount * Number(vatPct) / 100
  const total = afterDiscount + vatAmt

  const addItem = (tpl?: Partial<Item>) => {
    setItems(prev => [...prev, { description: tpl?.description||'', unit: tpl?.unit||'ตร.ม.', qty: tpl?.qty||1, unit_price: tpl?.unit_price||0 }])
  }
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = useCallback((i: number, field: keyof Item, val: string | number) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }, [])

  async function save() {
    if (!customerId) { setError('กรุณาเลือกลูกค้า'); return }
    if (items.some(i => !i.description.trim())) { setError('กรุณาใส่รายละเอียดทุกรายการ'); return }
    setSaving(true); setError('')
    try {
      const payload = { customer_id: customerId, job_id: jobId||null, status, discount, vat_pct: vatPct, notes, valid_until: validUntil||null, items }
      const url = mode === 'edit' ? `/api/quotations/${quotation!.id}` : '/api/quotations'
      const method = mode === 'edit' ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.error) { setError(data.error); setSaving(false); return }
      router.push(`/quotations/${data.data.id}`)
    } catch { setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง') }
    setSaving(false)
  }

  async function del() {
    if (!confirm('ลบใบเสนอราคานี้?')) return
    setDeleting(true)
    await fetch(`/api/quotations/${quotation!.id}`, { method: 'DELETE' })
    router.push('/quotations')
  }

  const filteredJobs = jobId ? jobs : jobs.filter(j => !customerId || j.customer_id === customerId)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href="/quotations" style={{ color: 'var(--text-muted)', fontSize: 14 }}>← ใบเสนอราคา</a>
            {quotation && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{quotation.quotation_no}</span>}
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {mode === 'new' ? '📋 สร้างใบเสนอราคาใหม่' : '✏️ แก้ไขใบเสนอราคา'}
          </h1>
        </div>
        {mode === 'edit' && (
          <button onClick={del} disabled={deleting} className="btn btn-danger">{deleting ? '...' : '🗑 ลบ'}</button>
        )}
      </div>

      {/* Header info */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
          <div>
            <label className="label">ลูกค้า *</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="input">
              <option value="">-- เลือกลูกค้า --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.line_note ? ` 🏷️${c.line_note}` : ''} ({c.phone})</option>)}
            </select>
          </div>
          <div>
            <label className="label">งานที่เกี่ยวข้อง</label>
            <select value={jobId} onChange={e => setJobId(e.target.value)} className="input">
              <option value="">-- ไม่ระบุ --</option>
              {filteredJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div>
            <label className="label">สถานะ</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="input">
              {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">ใช้ได้ถึงวันที่</label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="input" />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--dark)' }}>📦 รายการสินค้า/บริการ</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {/* Template dropdown */}
            <select onChange={e => { if(e.target.value) { const t=ITEM_TEMPLATES.find(t=>t.description===e.target.value); if(t) addItem(t); e.target.value='' } }}
              className="input" style={{ fontSize: 12, width: 'auto' }}>
              <option value="">+ เพิ่มจากแม่แบบ</option>
              {ITEM_TEMPLATES.map(t => <option key={t.description} value={t.description}>{t.description}</option>)}
            </select>
            <button onClick={() => addItem()} className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}>+ เพิ่มแถว</button>
          </div>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 110px 90px 32px', gap: 6, marginBottom: 6 }}>
          {['รายละเอียด','หน่วย','จำนวน','ราคา/หน่วย','รวม',''].map(h => (
            <div key={h} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{h}</div>
          ))}
        </div>

        {items.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 110px 90px 32px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
              className="input" style={{ fontSize: 12 }} placeholder="รายละเอียดสินค้า/บริการ" />
            <select value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}
              className="input" style={{ fontSize: 12 }}>
              {UNIT_OPTS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" value={item.qty} min={0.01} step={0.01}
              onChange={e => updateItem(i, 'qty', e.target.value)}
              className="input" style={{ fontSize: 12, textAlign: 'right' }} />
            <input type="number" value={item.unit_price} min={0} step={0.01}
              onChange={e => updateItem(i, 'unit_price', e.target.value)}
              className="input" style={{ fontSize: 12, textAlign: 'right' }} />
            <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--dark)' }}>
              {(Number(item.qty) * Number(item.unit_price)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
            <button onClick={() => removeItem(i)} disabled={items.length <= 1}
              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
          </div>
        ))}

        {/* Summary */}
        <div style={{ borderTop: '2px solid var(--border)', paddingTop: 14, marginTop: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ยอดรวม</span>
              <span style={{ fontSize: 15, fontWeight: 700, minWidth: 120, textAlign: 'right' }}>฿{subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ส่วนลด (฿)</span>
              <input type="number" value={discount} min={0} onChange={e => setDiscount(Number(e.target.value))}
                className="input" style={{ fontSize: 12, width: 120, textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>VAT (%)</span>
              <input type="number" value={vatPct} min={0} max={100} step={0.01} onChange={e => setVatPct(Number(e.target.value))}
                className="input" style={{ fontSize: 12, width: 120, textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>VAT ({vatPct}%)</span>
              <span style={{ fontSize: 13, minWidth: 120, textAlign: 'right' }}>฿{vatAmt.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark)' }}>ยอดสุทธิ</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)', minWidth: 120, textAlign: 'right' }}>
                ฿{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <label className="label">หมายเหตุ</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          className="textarea" rows={3} placeholder="เงื่อนไข หรือหมายเหตุเพิ่มเติม..." />
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
        <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 14, fontSize: 15 }}>
          {saving ? 'กำลังบันทึก...' : mode === 'new' ? '✅ สร้างใบเสนอราคา' : '💾 บันทึกการแก้ไข'}
        </button>
        <a href="/quotations" className="btn btn-ghost" style={{ padding: '14px 20px' }}>ยกเลิก</a>
      </div>
    </div>
  )
}
