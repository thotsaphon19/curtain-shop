'use client'
import { useState, useEffect } from 'react'

interface BankAccount { id: string; bank_name: string; account_name: string; account_number: string; branch?: string | null }

export default function BankAccountsSettings() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ bank_name: '', account_name: '', account_number: '', branch: '' })

  function load() {
    fetch('/api/settings/bank-accounts').then(r => r.json()).then(d => {
      setAccounts(d.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!form.bank_name.trim() || !form.account_name.trim() || !form.account_number.trim()) {
      alert('กรอกชื่อธนาคาร ชื่อบัญชี และเลขบัญชีให้ครบ'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/bank-accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!res.ok) { alert(d.error || 'บันทึกไม่สำเร็จ'); setSaving(false); return }
      setForm({ bank_name: '', account_name: '', account_number: '', branch: '' })
      setShowAdd(false)
      load()
    } catch { alert('เกิดข้อผิดพลาด') }
    setSaving(false)
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`ลบบัญชี "${label}" ออกจากรายการเลือกใช่ไหม? (งานเก่าที่เคยเลือกบัญชีนี้ไว้จะไม่กระทบ)`)) return
    const res = await fetch(`/api/settings/bank-accounts/${id}`, { method: 'DELETE' })
    if (res.ok) load()
    else alert('ลบไม่สำเร็จ')
  }

  if (loading) return null

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>🏦 บัญชีธนาคารของร้าน</h3>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 14px' }}>
        รายชื่อบัญชีที่เลือกได้ตอนสร้างงานใหม่/ใบแจ้งหนี้ — ไม่ต้องพิมพ์เลขบัญชีเองทุกครั้ง
      </p>

      {accounts.length === 0 && <div style={{ fontSize: 13, color: '#aaa', marginBottom: 12 }}>ยังไม่มีบัญชีในระบบ</div>}

      {accounts.map(a => (
        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{a.bank_name}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{a.account_name} — {a.account_number}{a.branch ? ` (สาขา${a.branch})` : ''}</div>
          </div>
          <button onClick={() => handleDelete(a.id, a.bank_name)} className="btn btn-ghost" style={{ color: 'var(--red)', fontSize: 12 }}>🗑 ลบ</button>
        </div>
      ))}

      {showAdd ? (
        <div style={{ marginTop: 14, padding: 14, background: 'var(--gray-lt)', borderRadius: 10 }}>
          <div className="form-grid" style={{ marginBottom: 10 }}>
            <input placeholder="ชื่อธนาคาร เช่น ธนาคารกสิกรไทย" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} className="input" />
            <input placeholder="ชื่อบัญชี" value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} className="input" />
            <input placeholder="เลขบัญชี" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} className="input" />
            <input placeholder="สาขา (ถ้ามี)" value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} className="input" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={saving} className="btn btn-primary" style={{ fontSize: 13 }}>{saving ? 'กำลังบันทึก...' : 'บันทึกบัญชี'}</button>
            <button onClick={() => setShowAdd(false)} className="btn btn-ghost" style={{ fontSize: 13 }}>ยกเลิก</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="btn btn-secondary" style={{ fontSize: 13, marginTop: 12 }}>+ เพิ่มบัญชีธนาคาร</button>
      )}
    </div>
  )
}
