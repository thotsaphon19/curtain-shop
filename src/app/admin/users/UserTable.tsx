'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const RC: Record<string, { icon: string; label: string; cls: string }> = {
  admin:      { icon: '👑', label: 'Admin',   cls: 'badge badge-purple' },
  technician: { icon: '👷', label: 'ช่าง',    cls: 'badge badge-amber' },
  customer:   { icon: '👤', label: 'ลูกค้า',  cls: 'badge badge-brand' },
  viewer:     { icon: '👁', label: 'Viewer',  cls: 'badge badge-blue' },
}
const SC: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'badge badge-green' },
  inactive:  { label: 'Inactive',  cls: 'badge badge-gray' },
  suspended: { label: 'Suspended', cls: 'badge badge-red' },
}

interface User {
  id: string; _source: 'app' | 'session'; session_id?: string
  line_user_id?: string; display_name: string; picture_url?: string
  role: string; status: string; phone?: string | null; email?: string | null
  notes?: string | null; line_note?: string | null; last_login_at?: string; created_at: string
}

export default function UserTable({ users: initial, currentAdminLineId }: { users: User[]; currentAdminLineId: string }) {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ display_name: string; phone: string; role: string; notes: string }>({ display_name: '', phone: '', role: '', notes: '' })
  const [roleModal, setRoleModal] = useState<User | null>(null)
  const [newRole, setNewRole] = useState('')
  const [phone, setPhone] = useState('')
  const [msg, setMsg] = useState('')

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(''), 5000) }

  function startEdit(u: User) {
    setEditing(u.id)
    setEditForm({ display_name: u.display_name, phone: u.phone || '', role: u.role, notes: u.notes || '' })
  }

  // ── บันทึกแก้ไข ──────────────────────────────────────────────────────────
  async function saveEdit(userId: string) {
    setSaving(userId)
    const user = users.find(u => u.id === userId)!
    let url = ''
    let realId = userId

    if (userId.startsWith('tech_')) {
      realId = userId.replace('tech_', '')
      url = `/api/technicians/${realId}`
    } else if (userId.startsWith('cust_')) {
      realId = userId.replace('cust_', '')
      url = `/api/customers/${realId}`
    } else {
      url = `/api/admin/users/${userId}`
    }

    const res = await fetch(url, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(userId.startsWith('tech_') || userId.startsWith('cust_')
          ? { name: editForm.display_name, phone: editForm.phone }
          : { display_name: editForm.display_name, phone: editForm.phone, role: editForm.role, notes: editForm.notes }
        )
      }),
    })
    const data = await res.json()
    if (data.data) {
      setUsers(u => u.map(x => x.id === userId ? { ...x, display_name: editForm.display_name, phone: editForm.phone, role: editForm.role, notes: editForm.notes } : x))
      setEditing(null)
      flash('✅ บันทึกแล้ว')
    } else flash('❌ ' + (data.error || 'ไม่สำเร็จ'))
    setSaving(null)
  }

  // ── ลบ ───────────────────────────────────────────────────────────────────
  async function deleteUser(u: User) {
    if (!confirm(`ลบ "${u.display_name}"?`)) return
    setSaving(u.id)
    let url = ''
    if (u.id.startsWith('tech_')) url = `/api/technicians/${u.id.replace('tech_', '')}`
    else if (u.id.startsWith('cust_')) url = `/api/customers/${u.id.replace('cust_', '')}`
    else url = `/api/admin/users/${u.id}`

    const res = await fetch(url, { method: 'DELETE' })
    if (res.ok) { setUsers(prev => prev.filter(x => x.id !== u.id)); flash('✅ ลบแล้ว') }
    else flash('❌ ลบไม่สำเร็จ')
    setSaving(null)
  }

  // ── ระงับ / เปิดใช้ (เฉพาะ app_user) ────────────────────────────────────
  async function toggleStatus(u: User, status: string) {
    if (u._source !== 'app') return
    setSaving(u.id)
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (data.data) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status } : x))
    setSaving(null)
  }

  // ── กำหนดสิทธิ์ session user → app_user ────────────────────────────────
  async function promoteSession(user: User, role: string, phoneNum: string) {
    setSaving(user.id)
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: user.display_name, phone: phoneNum, role, line_user_id: user.line_user_id, status: 'active' }),
    })
    const data = await res.json()
    if (data.data) {
      await fetch('/api/admin/users/sync-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_user_id: user.line_user_id, role, phone: phoneNum, display_name: user.display_name }),
      })
      flash(`✅ กำหนดสิทธิ์ "${user.display_name}" เป็น ${RC[role]?.label} แล้ว`)
      setRoleModal(null)
      setTimeout(() => router.refresh(), 600)
    } else flash('❌ ' + (data.error || 'ไม่สำเร็จ'))
    setSaving(null)
  }

  return (
    <div>
      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      {/* Role modal */}
      {roleModal && (
        <div className="overlay" onClick={() => setRoleModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>กำหนดสิทธิ์</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{roleModal.display_name}</div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">เบอร์โทร</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="input" placeholder="0812345678" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {['technician', 'customer', 'admin', 'viewer'].map(r => (
                <button key={r} onClick={() => setNewRole(r)} style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  border: `2px solid ${newRole === r ? 'var(--brand)' : 'var(--border)'}`,
                  background: newRole === r ? 'var(--brand-lt)' : 'var(--white)',
                  color: newRole === r ? 'var(--brand)' : 'var(--text)',
                }}>{RC[r]?.icon} {RC[r]?.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => newRole && promoteSession(roleModal, newRole, phone)}
                disabled={!newRole || !!saving} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {saving ? 'กำลังบันทึก...' : '✅ ยืนยัน'}
              </button>
              <button onClick={() => setRoleModal(null)} className="btn btn-ghost">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ผู้ใช้</th>
                <th className="hide-mobile">ชื่อเรียก</th>
                <th>Role</th>
                <th className="hide-mobile">โทร / LINE</th>
                <th>สถานะ</th>
                <th className="hide-mobile">เข้าระบบล่าสุด</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const rc = RC[user.role] || RC.viewer
                const sc = SC[user.status] || SC.active
                const isMe = user.line_user_id === currentAdminLineId
                const isSession = user._source === 'session'
                const isEditing = editing === user.id

                return (
                  <>
                    <tr key={user.id} style={{ background: isSession ? '#FFFBF0' : undefined }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {user.picture_url
                            ? <img src={user.picture_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gray)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{rc.icon}</div>
                          }
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {user.display_name}
                              {isMe && <span className="badge badge-purple" style={{ fontSize: 9 }}>คุณ</span>}
                              {isSession && <span className="badge badge-amber" style={{ fontSize: 9 }}>LINE</span>}
                            </div>
                            {user.email && <div className="text-xs text-muted">{user.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="hide-mobile text-small">
                        {user.line_note ? <span style={{ color: 'var(--brand)', fontWeight: 600 }}>🏷️ {user.line_note}</span> : <span className="text-muted">—</span>}
                      </td>
                      <td><span className={rc.cls}>{rc.icon} {rc.label}</span></td>
                      <td className="hide-mobile">
                        <div className="text-small">{user.phone || '-'}</div>
                        {user.line_user_id && <div className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>{user.line_user_id.slice(0, 14)}...</div>}
                      </td>
                      <td><span className={sc.cls}>{sc.label}</span></td>
                      <td className="hide-mobile text-xs text-muted">
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {isSession ? (
                            <button onClick={() => { setRoleModal(user); setNewRole(user.role); setPhone('') }}
                              disabled={!!saving} className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}>
                              กำหนดสิทธิ์
                            </button>
                          ) : (
                            <>
                              <button onClick={() => isEditing ? setEditing(null) : startEdit(user)}
                                className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 9px' }}>
                                {isEditing ? 'ยกเลิก' : '✏️'}
                              </button>
                              {user.status === 'active'
                                ? <button onClick={() => toggleStatus(user, 'suspended')} disabled={!!saving || isMe}
                                    className="btn btn-danger" style={{ fontSize: 11, padding: '4px 9px' }}>ระงับ</button>
                                : <button onClick={() => toggleStatus(user, 'active')} disabled={!!saving}
                                    className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 9px' }}>เปิดใช้</button>
                              }
                              {!isMe && (
                                <button onClick={() => deleteUser(user)} disabled={!!saving}
                                  className="btn btn-danger" style={{ fontSize: 11, padding: '4px 9px' }}>🗑</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Inline edit row */}
                    {isEditing && !isSession && (
                      <tr key={`edit_${user.id}`} style={{ background: 'var(--brand-lt)' }}>
                        <td colSpan={7} style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10, marginBottom: 10 }}>
                            <div>
                              <label className="label">ชื่อ</label>
                              <input value={editForm.display_name} onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} className="input" style={{ fontSize: 12 }} />
                            </div>
                            <div>
                              <label className="label">เบอร์โทร</label>
                              <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="input" style={{ fontSize: 12 }} />
                            </div>
                            <div>
                              <label className="label">Role</label>
                              <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                                className="input" style={{ fontSize: 12 }} disabled={isMe}>
                                {['admin','technician','customer','viewer'].map(r => (
                                  <option key={r} value={r}>{RC[r]?.icon} {RC[r]?.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">หมายเหตุ</label>
                              <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="input" style={{ fontSize: 12 }} placeholder="(ไม่บังคับ)" />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => saveEdit(user.id)} disabled={!!saving}
                              className="btn btn-primary" style={{ fontSize: 12, padding: '6px 16px' }}>
                              {saving === user.id ? 'กำลังบันทึก...' : '💾 บันทึก'}
                            </button>
                            <button onClick={() => setEditing(null)} className="btn btn-ghost" style={{ fontSize: 12 }}>ยกเลิก</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {users.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>ไม่พบผู้ใช้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
