'use client'
import { useState } from 'react'
import { AppUser } from '@/types'

const ROLE_CONFIG = {
  admin:      { icon: '👑', label: 'Admin',   cls: 'badge badge-purple' },
  technician: { icon: '👷', label: 'ช่าง',    cls: 'badge badge-amber' },
  customer:   { icon: '👤', label: 'ลูกค้า',  cls: 'badge badge-brand' },
  viewer:     { icon: '👁', label: 'Viewer',  cls: 'badge badge-blue' },
}
const STATUS_CONFIG = {
  active:    { label: 'Active',    cls: 'badge badge-green' },
  inactive:  { label: 'Inactive',  cls: 'badge badge-gray' },
  suspended: { label: 'Suspended', cls: 'badge badge-red' },
}

export default function UserTable({ users: initial, currentAdminLineId }: { users: AppUser[]; currentAdminLineId: string }) {
  const [users, setUsers] = useState<AppUser[]>(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<AppUser>>({})
  const [search, setSearch] = useState('')

  function startEdit(user: AppUser) {
    setEditing(user.id)
    setEditForm({ display_name: user.display_name, phone: user.phone, role: user.role, status: user.status, notes: user.notes })
  }

  async function saveEdit(userId: string) {
    setSaving(userId)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (data.data) {
      setUsers(u => u.map(x => x.id === userId ? { ...x, ...data.data } : x))
      setEditing(null)
    } else {
      alert(data.error || 'ไม่สำเร็จ')
    }
    setSaving(null)
  }

  async function quickAction(userId: string, patch: Partial<AppUser>) {
    setSaving(userId)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (data.data) setUsers(u => u.map(x => x.id === userId ? { ...x, ...data.data } : x))
    else alert(data.error || 'ไม่สำเร็จ')
    setSaving(null)
  }

  const filtered = users.filter(u =>
    !search || u.display_name.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search)
  )

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input" placeholder="🔍 ค้นหาชื่อ, เบอร์โทร..." style={{ maxWidth: 300 }} />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ผู้ใช้</th>
                <th>Role</th>
                <th className="hide-mobile">โทร / LINE</th>
                <th>สถานะ</th>
                <th className="hide-mobile">เข้าระบบล่าสุด</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => {
                const rc = ROLE_CONFIG[user.role] || ROLE_CONFIG.viewer
                const sc = STATUS_CONFIG[user.status] || STATUS_CONFIG.inactive
                const isMe = user.line_user_id === currentAdminLineId
                const isEditing = editing === user.id

                if (isEditing) {
                  return (
                    <tr key={user.id} style={{ background: 'var(--brand-lt)' }}>
                      <td colSpan={6} style={{ padding: 14 }}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div style={{ flex: 1, minWidth: 140 }}>
                            <label className="label">ชื่อ</label>
                            <input value={editForm.display_name || ''} onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} className="input" />
                          </div>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <label className="label">โทร</label>
                            <input value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="input" />
                          </div>
                          <div>
                            <label className="label">Role</label>
                            <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as AppUser['role'] }))} className="select" style={{ width: 'auto' }}>
                              {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="label">สถานะ</label>
                            <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as AppUser['status'] }))} className="select" style={{ width: 'auto' }}>
                              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </div>
                          <div style={{ flex: 2, minWidth: 160 }}>
                            <label className="label">หมายเหตุ</label>
                            <input value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="input" />
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => saveEdit(user.id)} disabled={saving === user.id} className="btn btn-primary" style={{ padding: '8px 14px' }}>
                              {saving === user.id ? '...' : 'บันทึก'}
                            </button>
                            <button onClick={() => setEditing(null)} className="btn btn-ghost" style={{ padding: '8px 12px' }}>ยกเลิก</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={user.id} style={{ opacity: user.status !== 'active' ? 0.6 : 1 }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {user.avatar_url
                          ? <img src={user.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                          : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--brand-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{rc.icon}</div>
                        }
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {user.display_name} {isMe && <span style={{ fontSize: 10, color: 'var(--brand)' }}>(คุณ)</span>}
                          </div>
                          {user.notes && <div className="text-xs text-muted">{user.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className={rc.cls}>{rc.icon} {rc.label}</span></td>
                    <td className="hide-mobile">
                      <div className="text-small">{user.phone || '—'}</div>
                      <div className="text-xs" style={{ color: user.line_user_id ? 'var(--brand)' : 'var(--text-muted)' }}>
                        {user.line_user_id ? `💬 ผูกแล้ว` : '⬜ ยังไม่ผูก LINE'}
                      </div>
                    </td>
                    <td><span className={sc.cls}>{sc.label}</span></td>
                    <td className="hide-mobile text-xs text-muted">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : 'ยังไม่เคย'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <a href={`/admin/users/${user.id}`} className="btn btn-secondary" style={{ padding: '4px 9px', fontSize: 11 }}>ดู</a>
                        {!isMe && (
                          <button onClick={() => startEdit(user)} className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 11 }}>แก้ไข</button>
                        )}
                        {!isMe && user.status === 'active' && (
                          <button onClick={() => quickAction(user.id, { status: 'suspended' })} disabled={saving === user.id} style={{ padding: '4px 8px', fontSize: 10, background: 'var(--red-lt)', color: 'var(--red)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                            ระงับ
                          </button>
                        )}
                        {!isMe && user.status !== 'active' && (
                          <button onClick={() => quickAction(user.id, { status: 'active' })} disabled={saving === user.id} style={{ padding: '4px 8px', fontSize: 10, background: 'var(--green-lt)', color: 'var(--green)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                            เปิดใช้
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>ไม่พบผู้ใช้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
