'use client'
import { useState } from 'react'

interface Category { id: string; name: string; icon: string }

export default function InventoryActions({ categories }: { categories: Category[] }) {
  const [modal, setModal] = useState<'item' | 'transaction' | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ name: '', sku: '', category_id: '', unit: 'ม้วน', qty: 0, min_qty: 0, cost_price: 0, sell_price: 0 })
  const [txn, setTxn] = useState({ item_id: '', type: 'in', qty: 0, note: '' })

  async function saveItem() {
    setSaving(true)
    const res = await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { setMsg('✅ เพิ่มสินค้าแล้ว'); setModal(null); setTimeout(() => location.reload(), 600) }
    setSaving(false)
  }

  async function saveTxn() {
    setSaving(true)
    const res = await fetch('/api/inventory/transaction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(txn) })
    if (res.ok) { setMsg('✅ บันทึกแล้ว'); setModal(null); setTimeout(() => location.reload(), 600) }
    setSaving(false)
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setModal('transaction')} style={{ background: '#E6F1FB', color: '#185FA5', padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ± รับ/จ่ายสินค้า
        </button>
        <button onClick={() => setModal('item')} style={{ background: '#0F6E56', color: '#fff', padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + เพิ่มสินค้า
        </button>
      </div>

      {/* Modal overlay */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto' }}>
            {modal === 'item' ? (
              <>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>เพิ่มสินค้าใหม่</h3>
                {[
                  { label: 'ชื่อสินค้า', key: 'name' as const },
                  { label: 'SKU (ไม่บังคับ)', key: 'sku' as const },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input value={(form as Record<string, unknown>)[f.key] as string} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>หมวดหมู่</label>
                    <select value={form.category_id} onChange={e => setForm(x => ({ ...x, category_id: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                      <option value="">-- เลือก --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>หน่วย</label>
                    <input value={form.unit} onChange={e => setForm(x => ({ ...x, unit: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[['คงเหลือ','qty'],['ต่ำสุด','min_qty'],['ราคาทุน','cost_price'],['ราคาขาย','sell_price']].map(([l,k]) => (
                    <div key={k}>
                      <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>{l}</label>
                      <input type="number" value={(form as Record<string, unknown>)[k] as number} onChange={e => setForm(x => ({ ...x, [k]: Number(e.target.value) }))}
                        style={{ width: '100%', padding: '8px 8px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>รับ / จ่าย สินค้า</h3>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>ประเภท</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['in','รับเข้า','#EAF3DE','#3B6D11'],['out','จ่ายออก','#FCEBEB','#A32D2D'],['adjust','ปรับยอด','#FAEEDA','#854F0B']].map(([v,l,bg,c]) => (
                      <button key={v} onClick={() => setTxn(x => ({ ...x, type: v }))} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${txn.type === v ? c : '#ddd'}`,
                        background: txn.type === v ? bg : '#fff', color: txn.type === v ? c : '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>จำนวน</label>
                  <input type="number" value={txn.qty} onChange={e => setTxn(x => ({ ...x, qty: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>หมายเหตุ</label>
                  <input value={txn.note} onChange={e => setTxn(x => ({ ...x, note: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={modal === 'item' ? saveItem : saveTxn} disabled={saving} style={{ flex: 1, padding: '10px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: '10px', background: '#F1EFE8', color: '#666', border: 'none', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
