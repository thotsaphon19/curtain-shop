'use client'
import { useState } from 'react'

interface Member { id: string; name: string; phone: string; line_user_id?: string; is_team_lead: boolean }
interface Team { id: string; name: string; line_group_id?: string; line_group_name?: string; notes?: string; members: Member[] }
interface Tech { id: string; name: string; phone: string; line_user_id?: string; team_id?: string }

export default function TeamManager({ teams: init, allTechs }: { teams: Team[]; allTechs: Tech[] }) {
  const [teams, setTeams] = useState<Team[]>(init)
  const [techs] = useState<Tech[]>(allTechs)
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null)
  const [saving, setSaving] = useState(false)

  // New team form
  const [showNewTeam, setShowNewTeam] = useState(false)
  const [newTeam, setNewTeam] = useState({ name: '', line_group_id: '', line_group_name: '', notes: '' })

  // Editing LINE group of a team
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [groupForm, setGroupForm] = useState({ line_group_id: '', line_group_name: '' })

  // Assign tech to team
  const [assignTeamId, setAssignTeamId] = useState<string | null>(null)
  const [assignTechId, setAssignTechId] = useState('')

  function flash(text: string, type: 'ok' | 'err' = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  // ── สร้างทีมใหม่ ─────────────────────────────────────────────────────────
  async function createTeam() {
    if (!newTeam.name.trim()) return
    setSaving(true)
    const res = await fetch('/api/teams', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTeam),
    })
    const data = await res.json()
    if (data.data) {
      setTeams(t => [...t, { ...data.data, members: [] }])
      setNewTeam({ name: '', line_group_id: '', line_group_name: '', notes: '' })
      setShowNewTeam(false)
      flash(`✅ สร้างทีม "${data.data.name}" แล้ว`)
    } else flash(data.error, 'err')
    setSaving(false)
  }

  // ── อัปเดต LINE Group ─────────────────────────────────────────────────────
  async function saveGroup(teamId: string) {
    setSaving(true)
    const res = await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(groupForm),
    })
    const data = await res.json()
    if (data.data) {
      setTeams(t => t.map(tm => tm.id === teamId ? { ...tm, ...groupForm } : tm))
      setEditingGroup(null)
      flash('✅ บันทึก LINE Group แล้ว')
    } else flash(data.error, 'err')
    setSaving(false)
  }

  // ── เพิ่มช่างเข้าทีม ──────────────────────────────────────────────────────
  async function addMember(teamId: string) {
    if (!assignTechId) return
    setSaving(true)
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ technician_id: assignTechId }),
    })
    const data = await res.json()
    if (data.data) {
      const tech = techs.find(t => t.id === assignTechId)!
      setTeams(prev => prev.map(tm => {
        if (tm.id === teamId) return { ...tm, members: [...tm.members.filter(m => m.id !== assignTechId), { id: tech.id, name: tech.name, phone: tech.phone, line_user_id: tech.line_user_id, is_team_lead: false }] }
        return { ...tm, members: tm.members.filter(m => m.id !== assignTechId) }
      }))
      setAssignTeamId(null)
      setAssignTechId('')
      flash(`✅ เพิ่ม ${tech.name} เข้าทีมแล้ว`)
    } else flash(data.error, 'err')
    setSaving(false)
  }

  // ── นำช่างออกจากทีม ───────────────────────────────────────────────────────
  async function removeMember(teamId: string, techId: string, techName: string) {
    if (!confirm(`นำ "${techName}" ออกจากทีม?`)) return
    setSaving(true)
    const res = await fetch(`/api/teams/${teamId}/members?technician_id=${techId}`, { method: 'DELETE' })
    if (res.ok) {
      setTeams(prev => prev.map(tm => tm.id === teamId ? { ...tm, members: tm.members.filter(m => m.id !== techId) } : tm))
      flash(`✅ นำ "${techName}" ออกจากทีมแล้ว`)
    }
    setSaving(false)
  }

  // ── ลบทีม ─────────────────────────────────────────────────────────────────
  async function deleteTeam(teamId: string, teamName: string) {
    if (!confirm(`ลบทีม "${teamName}"?`)) return
    setSaving(true)
    const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      setTeams(prev => prev.filter(t => t.id !== teamId))
      flash(`✅ ลบทีม "${teamName}" แล้ว`)
    } else flash(data.error, 'err')
    setSaving(false)
  }

  const unassigned = techs.filter(t => !teams.some(tm => tm.members.some(m => m.id === t.id)))

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">👷 ตั้งค่าทีมช่าง</h1>
          <p className="page-subtitle">กำหนด LINE Group ของแต่ละทีม — Admin มอบหมายงานให้ทีม ระบบแจ้งเข้ากลุ่มอัตโนมัติ</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/technicians" className="btn btn-ghost">← ช่างทั้งหมด</a>
          <button onClick={() => setShowNewTeam(true)} className="btn btn-primary">+ สร้างทีมใหม่</button>
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div className={`alert ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {/* How to get LINE Group ID */}
      <div className="card" style={{ padding: 18, marginBottom: 20, background: 'linear-gradient(135deg,#E1F5EE,#E6F1FB)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: 'var(--dark)' }}>
          📋 วิธีหา LINE Group ID ของทีมช่าง
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
          {[
            { n: '1', t: 'สร้างกลุ่ม LINE ของทีม' },
            { n: '2', t: 'แอด LINE OA ของร้านเข้ากลุ่ม' },
            { n: '3', t: 'ให้ใครในกลุ่มส่งข้อความ' },
            { n: '4', t: 'ดู Group ID ที่ Vercel Logs → /api/line/webhook' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ background: 'var(--brand)', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.n}</div>
              <div style={{ fontSize: 12, color: 'var(--dark)', lineHeight: 1.5 }}>{s.t}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
          💡 Group ID ขึ้นต้นด้วย <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4 }}>C</code> เช่น <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4 }}>C1234567890abcdef</code>
          &nbsp;— ใช้ <strong>LINE กลุ่มธรรมดา</strong> ของช่าง ไม่ใช่ LINE OA
          &nbsp;· บันทึกครั้งเดียว ระบบจำให้ตลอด แก้ไขได้ภายหลัง
        </div>
      </div>

      {/* New team form */}
      {showNewTeam && (
        <div className="card" style={{ padding: 20, marginBottom: 16, border: '2px solid var(--brand)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>🆕 สร้างทีมใหม่</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="label">ชื่อทีม *</label>
              <input value={newTeam.name} onChange={e => setNewTeam(f => ({ ...f, name: e.target.value }))}
                className="input" placeholder="เช่น ทีม A สายเหนือ" />
            </div>
            <div>
              <label className="label">ชื่อกลุ่ม LINE (จำง่าย)</label>
              <input value={newTeam.line_group_name} onChange={e => setNewTeam(f => ({ ...f, line_group_name: e.target.value }))}
                className="input" placeholder="เช่น กลุ่มช่างสายเหนือ" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="label">LINE Group ID (ใส่ทีหลังได้)</label>
            <input value={newTeam.line_group_id} onChange={e => setNewTeam(f => ({ ...f, line_group_id: e.target.value }))}
              className="input" placeholder="Cxxxxxxxxxxxxxxxxx" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createTeam} disabled={saving || !newTeam.name.trim()} className="btn btn-primary">
              {saving ? 'กำลังบันทึก...' : '✅ สร้างทีม'}
            </button>
            <button onClick={() => setShowNewTeam(false)} className="btn btn-ghost">ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Teams grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
        {teams.map(team => (
          <div key={team.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>

            {/* Team header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--dark)' }}>{team.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{team.members.length} คน</div>
              </div>
              <button onClick={() => deleteTeam(team.id, team.name)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
                title="ลบทีม">✕</button>
            </div>

            {/* LINE Group setting */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: team.line_group_id ? 'var(--green-lt,#E1F5EE)' : 'var(--amber-lt,#FAEEDA)' }}>
              {editingGroup === team.id ? (
                <div onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--dark)' }}>📱 ตั้งค่า LINE Group</div>
                  <input
                    value={groupForm.line_group_id}
                    onChange={e => setGroupForm(f => ({ ...f, line_group_id: e.target.value }))}
                    className="input" placeholder="LINE Group ID เช่น Cxxxxxxxxx"
                    style={{ marginBottom: 6, fontSize: 12 }}
                  />
                  <input
                    value={groupForm.line_group_name}
                    onChange={e => setGroupForm(f => ({ ...f, line_group_name: e.target.value }))}
                    className="input" placeholder="ชื่อกลุ่ม (จำง่าย)"
                    style={{ marginBottom: 8, fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => saveGroup(team.id)} disabled={saving} className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}>บันทึก</button>
                    <button onClick={() => setEditingGroup(null)} className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>ยกเลิก</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    {team.line_group_id ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green,#0F6E56)' }}>✅ เชื่อม LINE Group แล้ว</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {team.line_group_name && <span>{team.line_group_name} · </span>}
                          <code style={{ fontSize: 10 }}>{team.line_group_id}</code>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--amber,#854F0B)', fontWeight: 600 }}>⚠️ ยังไม่ได้ตั้ง LINE Group</div>
                    )}
                  </div>
                  <button
                    onClick={() => { setEditingGroup(team.id); setGroupForm({ line_group_id: team.line_group_id || '', line_group_name: team.line_group_name || '' }) }}
                    className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>
                    {team.line_group_id ? 'แก้ไข' : '+ ใส่ ID'}
                  </button>
                </div>
              )}
            </div>

            {/* Members list */}
            <div style={{ padding: '6px 0', minHeight: 60 }}>
              {team.members.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>ยังไม่มีช่างในทีม</div>
              ) : (
                team.members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderBottom: '1px solid #f5f5f5' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {m.name}
                        {m.is_team_lead && <span className="badge badge-amber" style={{ fontSize: 9 }}>หัวหน้า</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {m.phone}
                        {m.line_user_id && <span style={{ color: 'var(--green)', marginLeft: 6 }}>💬 LINE</span>}
                      </div>
                    </div>
                    <button onClick={() => removeMember(team.id, m.id, m.name)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}
                      title="นำออกจากทีม">✕</button>
                  </div>
                ))
              )}
            </div>

            {/* Add member */}
            {assignTeamId === team.id ? (
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--gray)' }}>
                <select value={assignTechId} onChange={e => setAssignTechId(e.target.value)}
                  className="input" style={{ marginBottom: 6, fontSize: 12 }}>
                  <option value="">-- เลือกช่าง --</option>
                  {techs.filter(t => !team.members.some(m => m.id === t.id)).map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.team_id ? '(ย้ายจากทีมเดิม)' : ''}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => addMember(team.id)} disabled={!assignTechId || saving}
                    className="btn btn-primary" style={{ fontSize: 11, padding: '5px 10px' }}>เพิ่ม</button>
                  <button onClick={() => { setAssignTeamId(null); setAssignTechId('') }}
                    className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}>ยกเลิก</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setAssignTeamId(team.id)}
                  style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  + เพิ่มช่างเข้าทีม
                </button>
              </div>
            )}
          </div>
        ))}

        {teams.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            ยังไม่มีทีม — กด "+ สร้างทีมใหม่" เพื่อเริ่มต้น
          </div>
        )}
      </div>

      {/* Unassigned pool */}
      {unassigned.length > 0 && (
        <div className="card" style={{ marginTop: 20, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--amber)', marginBottom: 10 }}>
            ⚠️ ช่างที่ยังไม่เข้าทีม ({unassigned.length} คน)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {unassigned.map(t => (
              <span key={t.id} style={{ padding: '5px 12px', borderRadius: 20, background: 'var(--amber-lt,#FAEEDA)', fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
                {t.name}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            กด "+ เพิ่มช่างเข้าทีม" ในทีมที่ต้องการ แล้วเลือกชื่อช่างจากรายการ
          </div>
        </div>
      )}
    </div>
  )
}
