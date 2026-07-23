'use client'
import { useState } from 'react'
import { Job, Technician } from '@/types'
import EditJobModal from './EditJobModal'

export default function JobActions({ job, technicians }: { job:Job; technicians:(Pick<Technician,'id'|'name'>&{line_user_id?:string|null})[] }) {
  const [selectedTech, setSelectedTech] = useState(job.technician_id || '')
  const [failureReason, setFailureReason] = useState(job.failure_reason || '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showEdit, setShowEdit] = useState(false)

  const selectedTechData = technicians.find(t => t.id === selectedTech)

  async function update(payload: Record<string,unknown>) {
    setLoading(true); setMsg('')
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) { setMsg('❌ ' + data.error); setLoading(false); return }

      // ── บอกผลแจ้งเตือนจริงๆ แทนที่จะบอก "บันทึกแล้ว" เฉยๆ ทั้งที่อีกฝั่งอาจไม่ได้รับ ──
      const failed: string[] = []
      if (data.technician_notify?.attempted === false && data.technician_notify?.reason) {
        failed.push(`ช่าง — ${data.technician_notify.reason}`)
      } else if (data.technician_notify?.attempted && !data.technician_notify.success) {
        failed.push(`ช่าง — ${data.technician_notify.reason || 'ไม่ทราบสาเหตุ'}`)
      }
      for (const r of (data.notify_results || [])) {
        if (r.type === 'technician_assigned') continue // อันนี้นับซ้ำกับ technician_notify ด้านบนแล้ว
        if (!r.success) {
          const who = r.recipient === 'customer' ? 'ลูกค้า' : 'ช่าง'
          failed.push(`${who} — ${r.reason || 'ไม่ทราบสาเหตุ'}`)
        }
      }
      if (failed.length > 0) {
        setMsg(`⚠️ บันทึกแล้ว แต่ส่งแจ้งเตือน LINE ไม่สำเร็จ:\n${failed.join('\n')}`)
      } else {
        setMsg('✅ บันทึกแล้ว')
      }
      setTimeout(()=>location.reload(),1200)
    } catch { setMsg('❌ เกิดข้อผิดพลาด') }
    setLoading(false)
  }

  const statusActions = [
    { label:'มอบหมายช่าง',    status:'assigned',    cls:'btn-secondary' },
    { label:'กำลังไปหน้างาน', status:'heading',     cls:'btn-secondary' },
    { label:'ช่างเริ่มงาน',   status:'in_progress', cls:'btn-primary' },
    { label:'ปิดงานสำเร็จ',   status:'completed',   cls:'btn-primary' },
    { label:'ยกเลิก',         status:'cancelled',   cls:'btn-danger' },
  ]

  return (
    <div className="card" style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--purple)' }}>การดำเนินการ</div>
        <button onClick={()=>setShowEdit(true)} className="btn btn-secondary" style={{ fontSize:12 }}>
          ✏️ แก้ไขข้อมูลงาน
        </button>
      </div>

      {showEdit && (
        <EditJobModal
          job={job}
          onClose={()=>setShowEdit(false)}
          onSaved={()=>location.reload()}
        />
      )}


      {/* Assign tech */}
      <div style={{ marginBottom:14 }}>
        <label className="label">มอบหมายช่าง</label>
        <div style={{ display:'flex', gap:8 }}>
          <select value={selectedTech} onChange={e=>setSelectedTech(e.target.value)} className="select">
            <option value="">-- เลือกช่าง --</option>
            {technicians.map(t=>
              <option key={t.id} value={t.id}>{t.name}{!t.line_user_id ? ' (ยังไม่ผูก LINE)' : ''}</option>
            )}
          </select>
          <button onClick={()=>selectedTech&&update({technician_id:selectedTech})} disabled={loading||!selectedTech} className="btn btn-secondary">มอบหมาย</button>
        </div>
        {selectedTechData && !selectedTechData.line_user_id && (
          <div style={{ fontSize:11, color:'var(--amber)', marginTop:4 }}>
            ⚠️ ช่างคนนี้ยังไม่ได้ผูกบัญชี LINE — มอบหมายแล้วจะไม่มีแจ้งเตือนไปหาช่าง (ไปผูกที่ Settings ก่อน)
          </div>
        )}
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
      {(job.status === 'in_progress' || job.status === 'assigned' || job.status === 'heading') && (
        <div style={{ marginBottom:14 }}>
          <label className="label">บันทึกปัญหาหน้างาน (ถ้ามี)</label>
          <div style={{ display:'flex', gap:8 }}>
            <input value={failureReason} onChange={e=>setFailureReason(e.target.value)} className="input" placeholder="ระบุปัญหา..."/>
            <button onClick={()=>failureReason&&update({failure_reason:failureReason})} disabled={loading||!failureReason} className="btn btn-amber">บันทึก</button>
          </div>
        </div>
      )}

      {msg && (
        <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : msg.startsWith('⚠️') ? 'alert-warning' : 'alert-error'}`} style={{ marginTop:8, whiteSpace:'pre-line' }}>
          {msg}
        </div>
      )}

      {/* Map links */}
      <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)', display:'flex', gap:8, flexWrap:'wrap' }}>
        <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer"
          className="btn btn-ghost" style={{ fontSize:12 }}>🗺️ Google Maps</a>
        <a href={`/map?date=${job.scheduled_date}`} className="btn btn-ghost" style={{ fontSize:12 }}>📅 ดูในแผนที่</a>
      </div>
    </div>
  )
}
