'use client'
import { useState } from 'react'

const PERMISSION_GROUPS = [
  {
    group: '📊 รายงานและข้อมูล',
    perms: [
      { key: 'can_view_reports',    label: 'ดูรายงาน' },
      { key: 'can_export_reports',  label: 'Export รายงาน' },
      { key: 'can_view_all_jobs',   label: 'ดูงานทุกชิ้น (ไม่ใช่แค่ของตัวเอง)' },
    ],
  },
  {
    group: '💳 การเงิน',
    perms: [
      { key: 'can_view_invoices',   label: 'ดู Invoice' },
      { key: 'can_create_invoices', label: 'สร้าง Invoice' },
      { key: 'can_mark_paid',       label: 'ยืนยันการชำระเงิน' },
    ],
  },
  {
    group: '🔧 จัดการงาน',
    perms: [
      { key: 'can_assign_jobs',     label: 'มอบหมายงาน' },
      { key: 'can_cancel_jobs',     label: 'ยกเลิกงาน' },
      { key: 'can_edit_jobs',       label: 'แก้ไขงาน' },
    ],
  },
  {
    group: '👥 จัดการผู้ใช้',
    perms: [
      { key: 'can_view_customers',  label: 'ดูข้อมูลลูกค้า' },
      { key: 'can_edit_customers',  label: 'แก้ไขลูกค้า' },
      { key: 'can_manage_users',    label: 'จัดการผู้ใช้งาน' },
    ],
  },
]

export default function UserPermissions({ userId, role, permissions: initial }: {
  userId: string; role: string; permissions: Record<string, boolean>
}) {
  const [perms, setPerms] = useState<Record<string, boolean>>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (role === 'admin') {
    return (
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>🔒 สิทธิ์การใช้งาน</div>
        <div className="alert alert-info" style={{ fontSize: 13 }}>
          Admin มีสิทธิ์เต็มทุกอย่าง ไม่ต้องตั้งค่าเพิ่มเติม
        </div>
      </div>
    )
  }

  async function save() {
    setSaving(true)
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: perms }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleAll(keys: string[], val: boolean) {
    setPerms(p => { const n = { ...p }; keys.forEach(k => { n[k] = val }); return n })
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>🔒 สิทธิ์การใช้งาน</div>
        <button onClick={save} disabled={saving} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
          {saving ? 'กำลังบันทึก...' : saved ? '✅ บันทึกแล้ว' : 'บันทึก'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PERMISSION_GROUPS.map(group => (
          <div key={group.group}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-soft)' }}>{group.group}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => toggleAll(group.perms.map(p => p.key), true)}
                  style={{ fontSize: 10, padding: '2px 8px', background: 'var(--green-lt)', color: 'var(--green)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>ทั้งหมด</button>
                <button onClick={() => toggleAll(group.perms.map(p => p.key), false)}
                  style={{ fontSize: 10, padding: '2px 8px', background: 'var(--red-lt)', color: 'var(--red)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>ล้าง</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {group.perms.map(p => (
                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: perms[p.key] ? 'var(--brand-lt)' : 'var(--gray)', cursor: 'pointer', border: `1px solid ${perms[p.key] ? 'var(--brand)' : 'var(--border)'}`, transition: 'all 0.12s' }}>
                  <input type="checkbox" checked={!!perms[p.key]} onChange={e => setPerms(pp => ({ ...pp, [p.key]: e.target.checked }))}
                    style={{ width: 15, height: 15, accentColor: 'var(--brand)' }} />
                  <span style={{ fontSize: 12, fontWeight: perms[p.key] ? 700 : 400, color: perms[p.key] ? 'var(--brand)' : 'var(--text-soft)' }}>
                    {p.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
