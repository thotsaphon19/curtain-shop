'use client'
import { useState, useEffect, useCallback } from 'react'

interface Contact {
  id: string
  kind: 'user' | 'group'
  line_id: string
  display_name: string | null
  note: string | null
  picture_url: string | null
  last_message: string | null
  oa_account_id: string | null
  last_seen_at: string
  linked_customer: { id: string; name: string } | null
  linked_technician: { id: string; name: string } | null
}

interface CustomerOption { id: string; name: string; phone: string }
interface TechnicianOption { id: string; name: string; phone: string }

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'เมื่อสักครู่'
  if (min < 60) return `${min} นาทีที่แล้ว`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ชม.ที่แล้ว`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} วันที่แล้ว`
  return new Date(iso).toLocaleDateString('th-TH')
}

export default function LineSeenContactsSettings() {
  const [tab, setTab] = useState<'user' | 'group'>('user')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [linkTargetType, setLinkTargetType] = useState<'customer' | 'technician'>('customer')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([])
  const [technicianResults, setTechnicianResults] = useState<TechnicianOption[]>([])
  const [linking, setLinking] = useState(false)
  const [linkNote, setLinkNote] = useState<string | null>(null)
  const [bulkImporting, setBulkImporting] = useState(false)
  const [noteEditId, setNoteEditId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ kind: tab })
    if (search.trim()) params.set('search', search.trim())
    const r = await fetch(`/api/settings/line-seen-contacts?${params}`)
    const d = await r.json()
    setContacts(d.data || [])
    setLoading(false)
  }, [tab, search])

  useEffect(() => { load() }, [load])

  // ดึงคนที่เคยแอดเพื่อน/ทัก OA เข้ามา แต่ยังไม่เคยถูกสร้างเป็นลูกค้า → สร้างให้อัตโนมัติทีเดียวทั้งหมด
  async function handleBulkImport() {
    if (!confirm('ดึงคนที่เคยแอดเพื่อน/ทัก LINE OA เข้ามาแต่ยังไม่มีในระบบ ให้กลายเป็น "ลูกค้าใหม่" ทั้งหมดทีเดียวเลยไหม?\n\n(คนที่ผูกกับลูกค้า/ช่างเดิมอยู่แล้วจะไม่ถูกแตะ ปลอดภัย)')) return
    setBulkImporting(true)
    setLinkNote(null)
    try {
      const r = await fetch('/api/settings/line-seen-contacts/bulk-import', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) { alert(d.error || 'ดึงข้อมูลไม่สำเร็จ'); setBulkImporting(false); return }
      setLinkNote(`✅ ดึงเข้ามาเป็นลูกค้าใหม่ ${d.imported} คน (ข้าม ${d.skipped} คนที่ผูกกับ record เดิมอยู่แล้ว จากทั้งหมด ${d.total} คน)`)
      load()
    } catch {
      alert('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    }
    setBulkImporting(false)
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function saveNote(id: string) {
    setSavingNote(true)
    try {
      const r = await fetch('/api/settings/line-seen-contacts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, note: noteDraft }),
      })
      if (r.ok) {
        setContacts(list => list.map(c => c.id === id ? { ...c, note: noteDraft.trim() || null } : c))
        setNoteEditId(null)
      } else alert('บันทึกไม่สำเร็จ')
    } catch { alert('เกิดข้อผิดพลาด') }
    setSavingNote(false)
  }

  async function remove(id: string) {
    if (!confirm('ลบออกจากลิสต์นี้? (ไม่กระทบสิทธิ์ LINE ใดๆ แค่ล้างประวัติ ถ้าทักมาใหม่จะขึ้นอีกครั้ง)')) return
    const r = await fetch('/api/settings/line-seen-contacts', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    if (r.ok) setContacts(c => c.filter(x => x.id !== id))
  }

  useEffect(() => {
    if (!linkingId || !customerSearch.trim()) { setCustomerResults([]); setTechnicianResults([]); return }
    const t = setTimeout(async () => {
      if (linkTargetType === 'customer') {
        const r = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch.trim())}`)
        const d = await r.json()
        setCustomerResults((d.data || []).slice(0, 8))
      } else {
        const r = await fetch(`/api/technicians?search=${encodeURIComponent(customerSearch.trim())}`)
        const d = await r.json()
        setTechnicianResults((d.data || []).slice(0, 8))
      }
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch, linkingId, linkTargetType])

  // ผูก userId เข้ากับลูกค้า/ช่างที่มีอยู่แล้ว — ใช้ตอนเปลี่ยน LINE OA แล้วต้องการ
  // ให้ record เดิม (ที่มีประวัติงานอยู่) รับ userId ใหม่แทนที่จะปล่อยให้ระบบ
  // สร้างลูกค้า/ช่างซ้ำอัตโนมัติ ระบบจะเคลียร์ userId ออกจาก record ซ้ำให้เองด้วย
  async function linkTo(contact: Contact, target: { id: string; name: string }, type: 'customer' | 'technician') {
    setLinking(true)
    setLinkNote(null)
    const r = await fetch('/api/settings/line-seen-contacts/link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_id: contact.line_id, target_type: type, target_id: target.id }),
    })
    const d = await r.json()
    if (r.ok) {
      setContacts(list => list.map(c => c.id === contact.id
        ? { ...c, linked_customer: type === 'customer' ? { id: target.id, name: target.name } : c.linked_customer,
                  linked_technician: type === 'technician' ? { id: target.id, name: target.name } : c.linked_technician }
        : c))
      if (d.cleared_duplicates?.length > 0) {
        setLinkNote(`✅ ผูกกับ "${target.name}" แล้ว — และเคลียร์ userId ซ้ำออกจาก ${d.cleared_duplicates.map((x: {name:string}) => x.name).join(', ')} ให้ด้วย (กันสับสนตอนแจ้งเตือนครั้งถัดไป)`)
      }
      setLinkingId(null); setCustomerSearch(''); setCustomerResults([]); setTechnicianResults([])
    } else {
      alert(d.error || 'ผูกไม่สำเร็จ')
    }
    setLinking(false)
  }

  async function unlinkCustomer(contact: Contact) {
    if (!contact.linked_customer) return
    if (!confirm(`เลิกผูก LINE นี้กับลูกค้า "${contact.linked_customer.name}"?`)) return
    const r = await fetch(`/api/customers/${contact.linked_customer.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line_user_id: null }),
    })
    if (r.ok) setContacts(list => list.map(c => c.id === contact.id ? { ...c, linked_customer: null } : c))
  }

  async function unlinkTechnician(contact: Contact) {
    if (!contact.linked_technician) return
    if (!confirm(`เลิกผูก LINE นี้กับช่าง "${contact.linked_technician.name}"?`)) return
    const r = await fetch(`/api/technicians/${contact.linked_technician.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line_user_id: null }),
    })
    if (r.ok) setContacts(list => list.map(c => c.id === contact.id ? { ...c, linked_technician: null } : c))
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>🪪 คนและกลุ่มที่เคยทัก LINE OA เข้ามา</h2>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>
        เมื่อมีคนทักหรือเชิญ OA เข้ากลุ่ม ระบบจะจำ <strong>userId / groupId</strong> ไว้ที่นี่อัตโนมัติทันที
        กด <strong>🔗 ผูกกับลูกค้า/ช่าง</strong> เพื่อผูก userId เข้ากับลูกค้าหรือช่างที่มีอยู่ในระบบได้เลย
        <strong> ไม่ต้องรอให้พิมพ์เบอร์โทรมาผูกเอง</strong>
        — ใช้จุดนี้เวลาเปลี่ยน LINE OA แล้วทุกคนต้องแอดเพื่อนใหม่: ให้ลูกค้า/ช่างแอดเพื่อน OA ใหม่แล้วทักมา 1 ครั้ง
        จากนั้นมาผูก userId ใหม่เข้ากับ record เดิม ระบบจะเคลียร์ userId เดิมออกจาก record ซ้ำที่อาจถูกสร้างอัตโนมัติให้เองด้วย
        เพื่อให้แจ้งเตือนกลับมาใช้งานได้ถูกคนอีกครั้ง
      </p>

      <button onClick={handleBulkImport} disabled={bulkImporting} className="btn btn-secondary" style={{ fontSize: 12, marginBottom: 14 }}>
        {bulkImporting ? '⏳ กำลังดึงข้อมูล...' : '📥 ดึงคนที่ยังไม่มีในระบบเป็น "ลูกค้าใหม่" ทั้งหมด'}
      </button>
      <div style={{ fontSize: 11, color: '#aaa', margin: '-10px 0 14px' }}>
        เหมาะกับคนที่แอดเพื่อน OA ใหม่ไปแล้วแต่ยังไม่เคยขึ้นเป็นลูกค้าในระบบ (เช่น เพิ่งเปลี่ยน OA แล้วมีคนแอดเพื่อนไว้ก่อนหน้านี้) —
        ถ้าคนนั้นเป็นลูกค้าเดิมอยู่แล้วในระบบ ให้ใช้ 🔗 ผูกกับลูกค้า/ช่าง แทน จะได้ไม่สร้างซ้ำ
      </div>

      {linkNote && (
        <div style={{ background: '#EAF3DE', color: '#3B6D11', fontSize: 12, padding: '8px 12px', borderRadius: 8, marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{linkNote}</span>
          <button onClick={() => setLinkNote(null)} className="btn btn-ghost" style={{ fontSize: 11, padding: '0 6px' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setTab('user')}
          className={`btn ${tab === 'user' ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 12 }}>
          👤 รายบุคคล
        </button>
        <button onClick={() => setTab('group')}
          className={`btn ${tab === 'group' ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 12 }}>
          👥 กลุ่ม LINE
        </button>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาจากชื่อ หรือ ID..." className="input" style={{ fontSize: 12, flex: 1, maxWidth: 260 }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'visible', borderRadius: 12 }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>กำลังโหลด...</div>
        ) : contacts.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            {tab === 'user'
              ? 'ยังไม่มีใครทักมาเลย — ให้คนที่ต้องการเพิ่มส่งข้อความอะไรก็ได้มาที่ LINE OA ของร้าน แล้วรีเฟรชหน้านี้'
              : 'ยังไม่มีกลุ่มไหนเชิญ OA เข้าเลย — เชิญ OA เข้ากลุ่ม LINE แล้วรีเฟรชหน้านี้'}
          </div>
        ) : contacts.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #f5f5f5' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
              background: 'var(--gray)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>
              {c.picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (c.kind === 'user' ? '👤' : '👥')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {c.display_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>ไม่ทราบชื่อ</span>}
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}> (ชื่อจริงจาก LINE)</span>
              </div>
              {noteEditId === c.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                  <input autoFocus value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                    placeholder="เช่น ลูกค้าตึกทอง ห้อง 501"
                    onKeyDown={e => { if (e.key === 'Enter') saveNote(c.id); if (e.key === 'Escape') setNoteEditId(null) }}
                    style={{ fontSize: 12, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, flex: 1, minWidth: 0 }} />
                  <button onClick={() => saveNote(c.id)} disabled={savingNote} className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }}>✅</button>
                  <button onClick={() => setNoteEditId(null)} className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }}>✕</button>
                </div>
              ) : (
                <div style={{ fontSize: 12, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {c.note ? (
                    <span style={{ color: 'var(--brand)', fontWeight: 600 }}>🏷️ {c.note}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>ยังไม่ได้ตั้งชื่อเรียก</span>
                  )}
                  <button onClick={() => { setNoteEditId(c.id); setNoteDraft(c.note || '') }}
                    className="btn btn-ghost" style={{ fontSize: 10, padding: '1px 6px' }}>✏️ แก้</button>
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <code style={{ background: 'var(--gray)', padding: '1px 5px', borderRadius: 3 }}>{c.line_id}</code>
                <button onClick={() => copy(c.line_id, c.id)} className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }}>
                  {copiedId === c.id ? '✅ คัดลอกแล้ว' : '📋 คัดลอก'}
                </button>
                <span>· ล่าสุด {timeAgo(c.last_seen_at)}</span>
              </div>
              {c.last_message && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  &ldquo;{c.last_message}&rdquo;
                </div>
              )}

              {c.kind === 'user' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {c.linked_customer && (
                    <span className="badge badge-gray" style={{ fontSize: 10, background: '#EAF3DE', color: '#3B6D11', display: 'flex', alignItems: 'center', gap: 5 }}>
                      ✅ ลูกค้า: {c.linked_customer.name}
                      <button onClick={() => unlinkCustomer(c)} className="btn btn-ghost" style={{ fontSize: 9, padding: '0 4px' }}>✕</button>
                    </span>
                  )}
                  {c.linked_technician && (
                    <span className="badge badge-gray" style={{ fontSize: 10, background: '#E4EEFB', color: '#1B5FA8', display: 'flex', alignItems: 'center', gap: 5 }}>
                      🔧 ช่าง: {c.linked_technician.name}
                      <button onClick={() => unlinkTechnician(c)} className="btn btn-ghost" style={{ fontSize: 9, padding: '0 4px' }}>✕</button>
                    </span>
                  )}

                  {linkingId === c.id ? (
                    <div style={{ marginTop: 4, position: 'relative', width: '100%', maxWidth: 280 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        <button onClick={() => { setLinkTargetType('customer'); setCustomerSearch('') }}
                          className={`btn ${linkTargetType === 'customer' ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 10, padding: '2px 8px' }}>ลูกค้า</button>
                        <button onClick={() => { setLinkTargetType('technician'); setCustomerSearch('') }}
                          className={`btn ${linkTargetType === 'technician' ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 10, padding: '2px 8px' }}>ช่าง</button>
                      </div>
                      <input
                        autoFocus value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                        placeholder={linkTargetType === 'customer' ? 'พิมพ์ชื่อหรือเบอร์โทรลูกค้า...' : 'พิมพ์ชื่อหรือเบอร์โทรช่าง...'}
                        className="input" style={{ fontSize: 11, padding: '4px 8px', width: '100%' }}
                      />
                      {linkTargetType === 'customer' && customerResults.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff',
                          border: '1px solid var(--border)', borderRadius: 8, marginTop: 2, maxHeight: 160, overflowY: 'auto',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                        }}>
                          {customerResults.map(cust => (
                            <div key={cust.id} onClick={() => linkTo(c, cust, 'customer')} style={{
                              padding: '6px 10px', fontSize: 11, cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                            }}>
                              {cust.name} <span style={{ color: 'var(--text-muted)' }}>· {cust.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {linkTargetType === 'technician' && technicianResults.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff',
                          border: '1px solid var(--border)', borderRadius: 8, marginTop: 2, maxHeight: 160, overflowY: 'auto',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                        }}>
                          {technicianResults.map(tech => (
                            <div key={tech.id} onClick={() => linkTo(c, tech, 'technician')} style={{
                              padding: '6px 10px', fontSize: 11, cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                            }}>
                              {tech.name} <span style={{ color: 'var(--text-muted)' }}>· {tech.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={() => { setLinkingId(null); setCustomerSearch(''); setCustomerResults([]); setTechnicianResults([]) }}
                        className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 6px', marginTop: 4 }} disabled={linking}>ยกเลิก</button>
                    </div>
                  ) : (
                    <button onClick={() => { setLinkingId(c.id); setCustomerSearch(''); setLinkTargetType('customer') }}
                      className="btn btn-secondary" style={{ fontSize: 10, padding: '3px 9px' }}>
                      🔗 ผูกกับลูกค้า/ช่าง
                    </button>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => remove(c.id)} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 9px', flexShrink: 0 }}>🗑</button>
          </div>
        ))}
      </div>
    </div>
  )
}
