'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Tech { id: string; name: string; line_user_id?: string; group_ids?: string[] }
interface JobData {
  id: string; title: string; address: string; status: string
  scheduled_date?: string; scheduled_time?: string
  priority?: number; amount?: number; deposit_amount?: number; vat_amount?: number | null
  customer?: { name: string; phone: string; address: string }
  technician_id?: string
}
interface Slot {
  id: string; technician_id: string; slot_date: string
  slot_start: string; slot_end: string; status: string; note?: string
  job?: { id: string; title: string; status: string; customer?: { name: string } }
}
interface Schedule { technician_id: string; max_jobs_day: number; slot_duration: number }
interface Props {
  technicians: Tech[]; jobs: JobData[]; slots: Slot[]
  schedules: Schedule[]; unassigned: JobData[]
  weekStart: string; weekEnd: string
}

const DAY_TH = ['อา','จ','อ','พ','พฤ','ศ','ส']
const DAY_TH_FULL = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']
const STATUS_COLOR: Record<string, string> = {
  pending: '#EF9F27', assigned: '#185FA5', heading: '#5B8DEF', in_progress: '#0F6E56',
  completed: '#3B6D11', overdue: '#E24B4A', cancelled: '#888',
}
const PRIORITY_COLOR = ['','#E24B4A','#EF9F27','#3B6D11','#185FA5','#888']

function getWeekDays(weekStart: string): Date[] {
  const days: Date[] = []
  const start = new Date(weekStart)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); days.push(d)
  }
  return days
}

function fmt(d: Date) { return d.toISOString().split('T')[0] }
function thDate(d: Date) { return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) }

export default function QueueBoard({ technicians, jobs, slots, schedules, unassigned, weekStart, weekEnd }: Props) {
  const router = useRouter()
  const weekDays = getWeekDays(weekStart)
  const today = fmt(new Date())

  const [selectedJob, setSelectedJob] = useState<JobData | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState('')
  const [slotState, setSlotState] = useState<Slot[]>(slots)
  const [jobState, setJobState] = useState<JobData[]>(jobs)
  const [unassignedState, setUnassignedState] = useState<JobData[]>(unassigned)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [techFilter, setTechFilter] = useState<string>('')

  function prevWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7)
    router.push(`/queue?week_start=${fmt(d)}`, { scroll: false })
  }
  function nextWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7)
    router.push(`/queue?week_start=${fmt(d)}`, { scroll: false })
  }
  function thisWeek() {
    const today2 = new Date()
    const mon = new Date(today2); mon.setDate(today2.getDate() - ((today2.getDay() + 6) % 7))
    router.push(`/queue?week_start=${fmt(mon)}`, { scroll: false })
  }

  // Generate slots for all technicians
  async function generateSlots() {
    setGenerating(true)
    const ids = techFilter ? [techFilter] : technicians.map(t => t.id)
    for (const tid of ids) {
      await fetch('/api/queue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', technician_id: tid, date_from: weekStart, date_to: weekEnd }),
      })
    }
    setMsg('สร้าง slot สำเร็จ')
    router.refresh()
    setGenerating(false)
  }

  // Assign selected job to a slot
  async function assignToSlot(slotId: string, date: string, time: string, techId: string) {
    if (!selectedJob) return
    setAssigning(true)
    const res = await fetch('/api/jobs/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: selectedJob.id, technician_id: techId, scheduled_date: date, scheduled_time: time, notify: true }),
    })
    const data = await res.json()
    let newMsg: string
    if (data.data) {
      // Update local state
      setSlotState(s => s.map(sl => sl.id === slotId ? { ...sl, status: 'booked', job: { id: selectedJob.id, title: selectedJob.title, status: 'assigned', customer: selectedJob.customer } } : sl))
      setJobState(j => j.map(jj => jj.id === selectedJob.id ? { ...jj, technician_id: techId, scheduled_date: date, scheduled_time: time, status: 'assigned' } : jj))
      setUnassignedState(u => u.filter(jj => jj.id !== selectedJob.id))
      const techName = technicians.find(t => t.id === techId)?.name
      const result = data.data[0]
      newMsg = (result && !result.notified && result.reason)
        ? `⚠️ มอบหมาย "${selectedJob.title}" ให้ ${techName} แล้ว แต่ส่งแจ้งเตือน LINE ไม่สำเร็จ — ${result.reason}`
        : `✅ มอบหมาย "${selectedJob.title}" ให้ ${techName} แล้ว`
      setMsg(newMsg)
      setSelectedJob(null)
    } else {
      newMsg = '❌ ' + (data.error || 'ไม่สำเร็จ')
      setMsg(newMsg)
    }
    setAssigning(false)
    setTimeout(() => setMsg(''), newMsg.startsWith('⚠️') ? 8000 : 4000)
  }

  // Get slots for a specific tech+date (จับคู่ทุก id ในกลุ่มชื่อเดียวกัน กันงานหายเวลามี record ซ้ำ)
  const getSlotsFor = useCallback((techIds: string[], date: string) =>
    slotState.filter(s => techIds.includes(s.technician_id) && s.slot_date === date),
  [slotState])

  const getJobsFor = useCallback((techIds: string[], date: string) =>
    jobState.filter(j => j.technician_id && techIds.includes(j.technician_id) && j.scheduled_date === date),
  [jobState])

  const displayTechs = techFilter ? technicians.filter(t => t.id === techFilter) : technicians

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📅 จัดคิวช่าง</h1>
          <p className="page-subtitle">มอบหมายและบริหารตารางงานรายสัปดาห์</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setView(v => v === 'calendar' ? 'list' : 'calendar')} className="btn btn-ghost" style={{ fontSize: 12 }}>
            {view === 'calendar' ? '📋 รายการ' : '📅 ปฏิทิน'}
          </button>
          <button onClick={generateSlots} disabled={generating} className="btn btn-secondary">
            {generating ? '⏳...' : '⚡ สร้าง Slot'}
          </button>
          <a href="/jobs/new" className="btn btn-primary">+ งานใหม่</a>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : msg.startsWith('⚠️') ? 'alert-warning' : 'alert-error'} mb-12`} style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}

      {/* Week nav + filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={prevWeek} className="btn btn-ghost" style={{ padding: '7px 10px' }}>←</button>
        <button onClick={thisWeek} className="btn btn-ghost" style={{ fontSize: 12 }}>วันนี้</button>
        <button onClick={nextWeek} className="btn btn-ghost" style={{ padding: '7px 10px' }}>→</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)' }}>
          {new Date(weekStart).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
          {' — '}
          {new Date(weekEnd).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <div style={{ flex: 1, minWidth: 40 }} />
        <select value={techFilter} onChange={e => setTechFilter(e.target.value)}
          className="select" style={{ width: 'auto', minWidth: 140 }}>
          <option value="">ช่างทั้งหมด</option>
          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Unassigned jobs panel ── */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div className="card" style={{ position: 'sticky', top: 12 }}>
            <div className="section-header">
              <span className="section-title">📋 รอมอบหมาย</span>
              <span className="badge badge-amber">{unassignedState.length}</span>
            </div>
            {selectedJob && (
              <div style={{ padding: '8px 12px', background: 'var(--brand-lt)', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--brand)', fontWeight: 700 }}>
                🎯 เลือก slot สำหรับ "{selectedJob.title}"
                <button onClick={() => setSelectedJob(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 14, fontWeight: 700 }}>×</button>
              </div>
            )}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {unassignedState.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>งานถูกมอบหมายครบแล้ว ✅</div>
              ) : unassignedState.map(job => {
                const pc = PRIORITY_COLOR[job.priority || 3]
                const isSelected = selectedJob?.id === job.id
                return (
                  <div key={job.id}
                    onClick={() => setSelectedJob(isSelected ? null : job)}
                    style={{
                      padding: '10px 12px', borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer', borderLeft: `3px solid ${pc}`,
                      background: isSelected ? 'var(--brand-lt)' : 'var(--white)',
                      transition: 'background 0.1s',
                    }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{job.customer?.name}</div>
                    {job.scheduled_date && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        📅 {job.scheduled_date} {job.scheduled_time?.slice(0,5)}
                      </div>
                    )}
                    {job.amount && (() => {
                      const total = job.amount + (job.vat_amount || 0)
                      const remain = total - (job.deposit_amount || 0)
                      return (
                        <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>
                          คงเหลือ ฿{remain.toLocaleString()}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Calendar / List view ── */}
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
          {view === 'calendar' ? (
            <div style={{ minWidth: displayTechs.length * 160 + 80 }}>
              {/* Date header row */}
              <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${weekDays.length}, 1fr)`, gap: 2, marginBottom: 4 }}>
                <div />
                {weekDays.map(day => {
                  const dateStr = fmt(day)
                  const isToday = dateStr === today
                  return (
                    <div key={dateStr} style={{
                      textAlign: 'center', padding: '6px 4px', borderRadius: 8,
                      background: isToday ? 'var(--brand)' : 'var(--white)',
                      boxShadow: 'var(--shadow-sm)',
                    }}>
                      <div style={{ fontSize: 11, color: isToday ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>{DAY_TH[day.getDay()]}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isToday ? '#fff' : 'var(--dark)' }}>{day.getDate()}</div>
                    </div>
                  )
                })}
              </div>

              {/* Tech rows */}
              {displayTechs.map(tech => {
                const sched = schedules.find(s => s.technician_id === tech.id)
                const maxJobs = sched?.max_jobs_day || 4
                return (
                  <div key={tech.id} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${weekDays.length}, 1fr)`, gap: 2 }}>
                      {/* Tech name */}
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 6px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tech.name}</div>
                        <div style={{ fontSize: 10, color: tech.line_user_id ? 'var(--brand)' : 'var(--text-muted)' }}>
                          {tech.line_user_id ? '💬' : '—'}
                        </div>
                      </div>

                      {weekDays.map(day => {
                        const dateStr = fmt(day)
                        const techIds = tech.group_ids && tech.group_ids.length > 0 ? tech.group_ids : [tech.id]
                        const dayJobs = getJobsFor(techIds, dateStr)
                        const daySlots = getSlotsFor(techIds, dateStr)
                        const availSlots = daySlots.filter(s => s.status === 'available')
                        const isToday = dateStr === today
                        const isFull = dayJobs.length >= maxJobs
                        const canDrop = selectedJob && availSlots.length > 0 && !isFull

                        return (
                          <div key={dateStr}
                            onClick={() => {
                              if (!canDrop) return
                              const firstAvail = availSlots[0]
                              if (firstAvail) assignToSlot(firstAvail.id, dateStr, firstAvail.slot_start, tech.id)
                            }}
                            style={{
                              minHeight: 80, borderRadius: 8, padding: 4,
                              background: canDrop ? 'var(--brand-lt)' : isToday ? '#F0FAF7' : 'var(--white)',
                              border: canDrop ? '2px dashed var(--brand)' : '1px solid var(--border)',
                              cursor: canDrop ? 'pointer' : 'default',
                              transition: 'all 0.1s',
                              boxShadow: 'var(--shadow-sm)',
                            }}>
                            {/* Slot count badge */}
                            {daySlots.length > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
                                <span style={{ fontSize: 9, background: isFull ? 'var(--red-lt)' : 'var(--green-lt)', color: isFull ? 'var(--red)' : 'var(--green)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                  {dayJobs.length}/{maxJobs}
                                </span>
                              </div>
                            )}

                            {dayJobs.map(job => (
                              <a key={job.id} href={`/jobs/${job.id}`}
                                onClick={e => e.stopPropagation()}
                                style={{ display: 'block', textDecoration: 'none', marginBottom: 3 }}>
                                <div style={{
                                  padding: '4px 6px', borderRadius: 6,
                                  background: STATUS_COLOR[job.status] + '20',
                                  borderLeft: `3px solid ${STATUS_COLOR[job.status] || '#888'}`,
                                }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                                  {job.scheduled_time && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{job.scheduled_time.slice(0,5)}</div>}
                                  {job.customer && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{job.customer.name}</div>}
                                </div>
                              </a>
                            ))}

                            {canDrop && dayJobs.length === 0 && (
                              <div style={{ fontSize: 10, color: 'var(--brand)', textAlign: 'center', paddingTop: 16 }}>แตะเพื่อมอบหมาย</div>
                            )}
                            {!daySlots.length && !dayJobs.length && (
                              <div style={{ fontSize: 9, color: '#ccc', textAlign: 'center', paddingTop: 20 }}>—</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* List view */
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>ช่าง</th>
                    <th>วันที่</th>
                    <th>เวลา</th>
                    <th>งาน</th>
                    <th>ลูกค้า</th>
                    <th>สถานะ</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {jobState.filter(j => !techFilter || j.technician_id === techFilter || technicians.find(t => t.id === techFilter)?.group_ids?.includes(j.technician_id || '')).map(job => {
                      const tech = technicians.find(t => t.id === job.technician_id || t.group_ids?.includes(job.technician_id || ''))
                      return (
                        <tr key={job.id}>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{tech?.name || <span style={{ color: '#ccc' }}>—</span>}</td>
                          <td className="text-small text-muted">{job.scheduled_date || '-'}</td>
                          <td className="text-small text-muted">{job.scheduled_time?.slice(0,5) || '-'}</td>
                          <td>
                            <a href={`/jobs/${job.id}`} style={{ fontWeight: 700, color: 'var(--dark)', fontSize: 13 }}>{job.title}</a>
                            <div className="text-xs text-muted">{job.address?.slice(0, 36)}</div>
                          </td>
                          <td className="text-small text-muted">{job.customer?.name}</td>
                          <td>
                            <span className="badge" style={{ background: STATUS_COLOR[job.status] + '22', color: STATUS_COLOR[job.status] }}>
                              {job.status}
                            </span>
                          </td>
                          <td><a href={`/jobs/${job.id}`} style={{ color: 'var(--brand)', fontSize: 12, fontWeight: 700 }}>แก้ไข →</a></td>
                        </tr>
                      )
                    })}
                    {jobState.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>ไม่มีงานในสัปดาห์นี้</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
