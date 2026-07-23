'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Customer } from '@/types'

interface JobLite { id: string; title: string; amount?: number; bank_account?: string; qr_code_url?: string; customer_id: string; status: string }
interface FieldTemplate { id: string; field_key: string; label: string; field_type: 'text'|'number'|'date'|'textarea'; required: boolean }

export default function NewInvoicePage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [jobs, setJobs] = useState<JobLite[]>([])
  const [fields, setFields] = useState<FieldTemplate[]>([])
  const [bankAccounts, setBankAccounts] = useState<{id:string;bank_name:string;account_name:string;account_number:string;branch?:string|null}[]>([])
  const [bankAccountChoice, setBankAccountChoice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    customer_id: '', job_id: '', subtotal: '', discount: '0', vat_pct: '0',
    due_date: '', bank_account: '', qr_code_url: '', notes: '',
  })
  const [customValues, setCustomValues] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => setCustomers(d.data || []))
    fetch('/api/jobs').then(r => r.json()).then(d => setJobs(d.data || []))
    fetch('/api/invoice-field-templates').then(r => r.json()).then(d => setFields(d.data || []))
    fetch('/api/settings/bank-accounts').then(r => r.json()).then(d => setBankAccounts(d.data || []))
  }, [])

  function onBankAccountChoice(id: string) {
    setBankAccountChoice(id)
    if (id === '__custom__') { setForm(f => ({ ...f, bank_account: '' })); return }
    const acc = bankAccounts.find(a => a.id === id)
    if (!acc) { setForm(f => ({ ...f, bank_account: '' })); return }
    setForm(f => ({ ...f, bank_account: `${acc.bank_name}\n${acc.account_name}\nเลขบัญชี ${acc.account_number}${acc.branch ? `\nสาขา${acc.branch}` : ''}` }))
  }

  const customerJobs = jobs.filter(j => j.customer_id === form.customer_id)

  function onCustomerChange(id: string) {
    setForm(f => ({ ...f, customer_id: id, job_id: '' }))
  }

  function onJobChange(id: string) {
    const j = jobs.find(j => j.id === id)
    setForm(f => ({
      ...f, job_id: id,
      subtotal: j?.amount != null ? String(j.amount) : f.subtotal,
      bank_account: j?.bank_account || f.bank_account,
      qr_code_url: j?.qr_code_url || f.qr_code_url,
      notes: j?.title || f.notes,
    }))
  }

  const subtotal = Number(form.subtotal || 0)
  const discount = Number(form.discount || 0)
  const vatPct = Number(form.vat_pct || 0)
  const total = Math.max(0, subtotal - discount) * (1 + vatPct / 100)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    if (!form.customer_id) { setError('กรุณาเลือกลูกค้า'); setLoading(false); return }
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: form.customer_id,
          job_id: form.job_id || null,
          invoice_type: 'installation',
          subtotal, discount, vat_pct: vatPct,
          due_date: form.due_date || null,
          bank_account: form.bank_account || null,
          qr_code_url: form.qr_code_url || null,
          notes: form.notes || null,
          custom_fields: customValues,
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      router.push(`/invoices/${data.data.id}`)
    } catch { setError('เกิดข้อผิดพลาด'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--gray)' }}>
      <header style={{ background: 'var(--dark)', padding: '0 16px', height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/invoices" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}>←</a>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>สร้าง Invoice (งานติดตั้ง)</span>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--content-p)', paddingBottom: 40 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand)', marginBottom: 14 }}>ลูกค้า / งาน</div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">ลูกค้า <span style={{ color: 'var(--red)' }}>*</span></label>
              <select required value={form.customer_id} onChange={e => onCustomerChange(e.target.value)} className="select">
                <option value="">-- เลือกลูกค้า --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.line_note ? ` 🏷️${c.line_note}` : ''} ({c.phone})</option>)}
              </select>
            </div>
            {form.customer_id && (
              <div>
                <label className="label">ผูกกับงาน (ถ้ามี — ระบบจะดึงยอด/บัญชีจากงานให้อัตโนมัติ)</label>
                <select value={form.job_id} onChange={e => onJobChange(e.target.value)} className="select">
                  <option value="">-- ไม่ผูกกับงาน --</option>
                  {customerJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand)', marginBottom: 4 }}>ยอดค่าติดตั้ง</div>
            <div className="text-xs text-muted" style={{ marginBottom: 12 }}>Invoice นี้เป็นค่าบริการติดตั้ง ไม่มีรายการสินค้าแยก</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="label">ยอดค่าติดตั้ง (บาท) <span style={{ color: 'var(--red)' }}>*</span></label>
                <input required type="number" min={0} step="0.01" value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">ส่วนลด (บาท)</label>
                <input type="number" min={0} step="0.01" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">VAT (%)</label>
                <input type="number" min={0} step="0.01" value={form.vat_pct} onChange={e => setForm(f => ({ ...f, vat_pct: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">ครบกำหนดชำระ</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="input" />
              </div>
            </div>
            <div style={{ background: 'var(--brand-lt)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>ยอดรวมสุทธิ</span><span>฿{total.toLocaleString()}</span>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand)', marginBottom: 14 }}>การรับชำระ</div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">เลขบัญชี / พร้อมเพย์</label>
              <select value={bankAccountChoice} onChange={e => onBankAccountChoice(e.target.value)} className="select">
                <option value="">-- เลือกบัญชี --</option>
                {bankAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.bank_name} — {a.account_name} — {a.account_number}</option>
                ))}
                <option value="__custom__">อื่นๆ (กรอกเอง)</option>
              </select>
              {bankAccountChoice === '__custom__' && (
                <textarea value={form.bank_account} onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} className="textarea" rows={3}
                  placeholder="เช่น กสิกรไทย 123-4-56789-0" style={{ marginTop: 8, resize: 'vertical' }} />
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">ลิงก์ QR Code ชำระเงิน</label>
              <input value={form.qr_code_url} onChange={e => setForm(f => ({ ...f, qr_code_url: e.target.value }))} className="input" placeholder="https://..." />
            </div>
            <div>
              <label className="label">หมายเหตุ</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input" rows={2} />
            </div>
          </div>

          {fields.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand)', marginBottom: 4 }}>ฟิลด์เพิ่มเติมของร้าน</div>
              <div className="text-xs text-muted" style={{ marginBottom: 12 }}>
                จัดการฟิลด์เหล่านี้ได้ที่ <a href="/settings" style={{ color: 'var(--brand)' }}>ตั้งค่า</a>
              </div>
              {fields.map(f => (
                <div key={f.id} style={{ marginBottom: 12 }}>
                  <label className="label">{f.label} {f.required && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                  {f.field_type === 'textarea' ? (
                    <textarea required={f.required} className="input" rows={2}
                      value={customValues[f.field_key] || ''}
                      onChange={e => setCustomValues(v => ({ ...v, [f.field_key]: e.target.value }))} />
                  ) : (
                    <input required={f.required} type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'} className="input"
                      value={customValues[f.field_key] || ''}
                      onChange={e => setCustomValues(v => ({ ...v, [f.field_key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '14px', fontSize: 15 }}>
            {loading ? 'กำลังบันทึก...' : '✅ สร้าง Invoice'}
          </button>
        </form>
      </div>
    </div>
  )
}
