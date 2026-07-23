'use client'
import { useState, useEffect } from 'react'

interface Account {
  id: string
  account_type: 'accounting' | 'management'
  name: string
  line_user_id: string
  active: boolean
  oa_account_id?: string | null
}

interface OAAccountOption { id: string; name: string; is_default: boolean; active: boolean }

const TYPE_CONFIG = {
  accounting:  { icon: '💰', label: 'ฝ่ายบัญชี',  color: 'var(--green)',  bg: 'var(--green-lt)',  desc: 'รับแจ้งเตือนการชำระเงิน ยอดค้างชำระ Invoice' },
  management:  { icon: '👔', label: 'ผู้บริหาร',   color: 'var(--blue)',   bg: 'var(--blue-lt)',   desc: 'รับสรุปยอดรายวัน รายงานสำคัญ' },
}

function AccountSection({ type, accounts, oaAccounts, onAdd, onToggle, onDelete, onSetOA }: {
  type: 'accounting' | 'management'
  accounts: Account[]
  oaAccounts: OAAccountOption[]
  onAdd: (type: string, name: string, lineUserId: string, oaAccountId: string) => Promise<void>
  onToggle: (id: string, active: boolean) => Promise<void>
  onDelete: (id: string, name: string) => Promise<void>
  onSetOA: (id: string, oaAccountId: string) => Promise<void>
}) {
  const tc = TYPE_CONFIG[type]
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [lineUserId, setLineUserId] = useState('')
  const [oaAccountId, setOaAccountId] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!name.trim() || !lineUserId.trim()) return
    setSaving(true)
    await onAdd(type, name.trim(), lineUserId.trim(), oaAccountId)
    setName(''); setLineUserId(''); setOaAccountId(''); setShowForm(false)
    setSaving(false)
  }

  return (
    <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: tc.bg, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: tc.color }}>{tc.icon} {tc.label}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{tc.desc}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{accounts.filter(a => a.active).length} แอคเคาท์</span>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}>
            {showForm ? 'ยกเลิก' : '+ เพิ่ม'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ padding: '12px 16px', background: '#FAFFF9', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="label">ชื่อ-นามสกุล *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="input" style={{ fontSize: 12 }} placeholder="เช่น คุณสมหญิง บัญชีดี" />
            </div>
            <div>
              <label className="label">LINE User ID *</label>
              <input value={lineUserId} onChange={e => setLineUserId(e.target.value)}
                className="input" style={{ fontSize: 12 }} placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            </div>
            {oaAccounts.length > 1 && (
              <div>
                <label className="label">ส่งผ่านบัญชี OA</label>
                <select value={oaAccountId} onChange={e => setOaAccountId(e.target.value)} className="input" style={{ fontSize: 12 }}>
                  <option value="">⭐ ใช้บัญชี default</option>
                  {oaAccounts.map(a => <option key={a.id} value={a.id}>{a.name}{!a.active ? ' (ปิดใช้)' : ''}</option>)}
                </select>
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            💡 หา LINE User ID: เปิด LINE Developers → ส่งข้อความผ่าน LINE OA → ดูใน Vercel Logs
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={submit} disabled={saving || !name || !lineUserId}
              className="btn btn-primary" style={{ fontSize: 11, padding: '5px 14px' }}>
              {saving ? 'กำลังบันทึก...' : '✅ เพิ่มแอคเคาท์'}
            </button>
          </div>
        </div>
      )}

      {/* Accounts list */}
      {accounts.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          ยังไม่มีแอคเคาท์ — กด "+ เพิ่ม" เพื่อเพิ่ม {tc.label}
        </div>
      ) : accounts.map(acc => (
        <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #f5f5f5' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: acc.active ? tc.bg : 'var(--gray)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>
            {tc.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: acc.active ? 'var(--dark)' : 'var(--text-muted)' }}>
                {acc.name}
              </span>
              {!acc.active && <span className="badge badge-gray" style={{ fontSize: 9 }}>ปิดใช้</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              <code style={{ background: 'var(--gray)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>
                {acc.line_user_id.slice(0, 18)}...
              </code>
              {oaAccounts.length > 1 && acc.oa_account_id && (
                <span style={{ marginLeft: 8 }}>· 📡 {oaAccounts.find(a => a.id === acc.oa_account_id)?.name || 'OA ที่ถูกลบไปแล้ว'}</span>
              )}
            </div>
          </div>
          {oaAccounts.length > 1 && (
            <select
              value={acc.oa_account_id || ''}
              onChange={e => onSetOA(acc.id, e.target.value)}
              className="input" style={{ fontSize: 10, padding: '3px 6px', width: 120, flexShrink: 0 }}
            >
              <option value="">⭐ default</option>
              {oaAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <button onClick={() => onToggle(acc.id, !acc.active)}
              className={`btn ${acc.active ? 'btn-ghost' : 'btn-secondary'}`}
              style={{ fontSize: 11, padding: '4px 9px' }}>
              {acc.active ? '⏸ ปิด' : '▶ เปิด'}
            </button>
            <button onClick={() => onDelete(acc.id, acc.name)}
              className="btn btn-danger" style={{ fontSize: 11, padding: '4px 9px' }}>🗑</button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NotifyAccountsSettings({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [oaAccounts, setOaAccounts] = useState<OAAccountOption[]>([])
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000) }

  useEffect(() => {
    fetch('/api/settings/line-oa-accounts').then(r => r.json()).then(d => setOaAccounts(d.data || []))
  }, [])

  async function addAccount(type: string, name: string, lineUserId: string, oaAccountId: string) {
    const res = await fetch('/api/settings/notify-accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_type: type, name, line_user_id: lineUserId, oa_account_id: oaAccountId || null }),
    })
    const data = await res.json()
    if (data.data) { setAccounts(a => [...a, data.data]); flash(`✅ เพิ่ม "${name}" แล้ว`) }
    else flash('❌ ' + data.error, false)
  }

  async function toggleAccount(id: string, active: boolean) {
    const res = await fetch(`/api/settings/notify-accounts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }),
    })
    if (res.ok) setAccounts(a => a.map(x => x.id === id ? { ...x, active } : x))
  }

  async function setAccountOA(id: string, oaAccountId: string) {
    const res = await fetch(`/api/settings/notify-accounts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oa_account_id: oaAccountId || null }),
    })
    if (res.ok) { setAccounts(a => a.map(x => x.id === id ? { ...x, oa_account_id: oaAccountId || null } : x)); flash('✅ ตั้งค่าบัญชี OA แล้ว') }
  }

  async function deleteAccount(id: string, name: string) {
    if (!confirm(`ลบ "${name}"?`)) return
    const res = await fetch(`/api/settings/notify-accounts/${id}`, { method: 'DELETE' })
    if (res.ok) { setAccounts(a => a.filter(x => x.id !== id)); flash(`✅ ลบ "${name}" แล้ว`) }
    else flash('❌ ลบไม่สำเร็จ', false)
  }

  return (
    <div>
      {msg && (
        <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      <div style={{ background: 'var(--amber-lt,#FAEEDA)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>📱 วิธีหา LINE User ID ของบุคคล</div>
        <div style={{ color: 'var(--dark)', lineHeight: 1.7 }}>
          1. ให้บุคคลนั้นส่งข้อความมาที่ <strong>LINE OA</strong> ของร้าน<br />
          2. เลื่อนขึ้นไปที่หัวข้อ <strong>&quot;🪪 คนและกลุ่มที่เคยทัก LINE OA เข้ามา&quot;</strong> ด้านบน<br />
          3. หาชื่อที่ต้องการแล้วกด <strong>📋 คัดลอก</strong> เอา userId มาวางที่นี่ได้เลย
        </div>
      </div>

      {(['accounting', 'management'] as const).map(type => (
        <AccountSection
          key={type} type={type}
          accounts={accounts.filter(a => a.account_type === type)}
          oaAccounts={oaAccounts}
          onAdd={addAccount} onToggle={toggleAccount} onDelete={deleteAccount} onSetOA={setAccountOA}
        />
      ))}
    </div>
  )
}
