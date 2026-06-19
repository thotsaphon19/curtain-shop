'use client'
import { useState } from 'react'
import { Job, Technician } from '@/types'

export default function JobActions({ job, technicians }: { job:Job; technicians:Pick<Technician,'id'|'name'>[] }) {
  const [selectedTech, setSelectedTech] = useState(job.technician_id || '')
  const [failureReason, setFailureReason] = useState(job.failure_reason || '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function update(payload: Record<string,unknown>) {
    setLoading(true); setMsg('')
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) setMsg('❌ ' + data.error)
      else { setMsg('✅ บันทึกแล้ว'); setTimeout(()=>location.reload(),800) }
    } catch { setMsg('❌ เกิดข้อผิดพลาด') }
    setLoading(false)
  }

  const statusActions = [
    { label:'มอบหมายช่าง',    status:'assigned',    cls:'btn-secondary' },
    { label:'ช่างเริ่มงาน',   status:'in_progress', cls:'btn-primary' },
    { label:'ปิดงานสำเร็จ',   status:'completed',   cls:'btn-primary' },
    { label:'ยกเลิก',         status:'cancelled',   cls:'btn-danger' },
  ]

  return (
    <div className="card" style={{ padding:20 }}>
      <div style={{ fontSize:14, fontWeight:700, color:'var(--purple)', marginBottom:14 }}>การดำเนินการ</div>

      {/* Assign tech */}
      <div style={{ marginBottom:14 }}>
        <label className="label">มอบหมายช่าง</label>
        <div style={{ display:'flex', gap:8 }}>
          <select value={selectedTech} onChange={e=>setSelectedTech(e.target.value)} className="select">
            <option value="">-- เลือกช่าง --</option>
            {technicians.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={()=>selectedTech&&update({technician_id:selectedTech})} disabled={loading||!selectedTech} className="btn btn-secondary">มอบหมาย</button>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom:14 }}>
        <label className="label">เปลี่ยนสถานะ</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {statusActions.map(a => (
            <button key={a.status} onClick={()=>update(a.status==='cancelled'&&failureReason?{status:a.status,failure_reason:failureReason}:{status:a.status})}
              disabled={loading||job.status===a.status}
              className={`btn ${a.cls}`}
              style={{ fontSize:12, opacity:job.status===a.status?0.4:1 }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Failure reason */}
      {(job.status === 'in_progress' || job.status === 'assigned') && (
        <div style={{ marginBottom:14 }}>
          <label className="label">บันทึกปัญหาหน้างาน (ถ้ามี)</label>
          <div style={{ display:'flex', gap:8 }}>
            <input value={failureReason} onChange={e=>setFailureReason(e.target.value)} className="input" placeholder="ระบุปัญหา..."/>
            <button onClick={()=>failureReason&&update({failure_reason:failureReason})} disabled={loading||!failureReason} className="btn btn-amber">บันทึก</button>
          </div>
        </div>
      )}

      {msg && <div className={`alert ${msg.startsWith('✅')?'alert-success':'alert-error'}`} style={{ marginTop:8 }}>{msg}</div>}

      {/* Map links */}
      <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)', display:'flex', gap:8, flexWrap:'wrap' }}>
        <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer"
          className="btn btn-ghost" style={{ fontSize:12 }}>🗺️ Google Maps</a>
        <a href={`/map?date=${job.scheduled_date}`} className="btn btn-ghost" style={{ fontSize:12 }}>📅 ดูในแผนที่</a>
      </div>
    </div>
  )
}
