'use client'
import { useState, useRef } from 'react'
import { Job } from '@/types'

export default function TechnicianJobCard({ job }: { job: Job }) {
  const [status, setStatus] = useState(job.status)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)

  const cust = (job as unknown as {customer:{name:string,phone:string,address:string}}).customer

  async function updateStatus(newStatus: string, photoFile?: File, photoType?: 'start'|'end') {
    setLoading(true)
    setMsg('')
    try {
      if (photoFile) {
        const base64 = await toBase64(photoFile)
        await fetch('/api/jobs/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: job.id, type: photoType, base64, filename: photoFile.name }),
        })
      }
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.error) setMsg('❌ ' + data.error)
      else { setStatus(newStatus as Job['status']); setMsg('✅ อัปเดตแล้ว') }
    } catch { setMsg('❌ เกิดข้อผิดพลาด') }
    setLoading(false)
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function handlePhotoChange(type: 'start'|'end') {
    const ref = type === 'start' ? startRef : endRef
    const file = ref.current?.files?.[0]
    if (!file) return
    const newStatus = type === 'start' ? 'in_progress' : 'completed'
    updateStatus(newStatus, file, type)
  }

  const STATUS_COLOR: Record<string,{bg:string,color:string,label:string}> = {
    pending:     { bg:'#FAEEDA', color:'#854F0B', label:'รอเริ่ม' },
    assigned:    { bg:'#E6F1FB', color:'#185FA5', label:'มอบหมายแล้ว' },
    in_progress: { bg:'#E1F5EE', color:'#0F6E56', label:'กำลังทำ' },
    completed:   { bg:'#EAF3DE', color:'#3B6D11', label:'เสร็จแล้ว' },
  }
  const sc = STATUS_COLOR[status] || STATUS_COLOR.pending

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden', borderLeft: `4px solid ${sc.color}` }}>
      {/* Summary row */}
      <div onClick={() => setShowDetail(!showDetail)} style={{ padding: '14px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0F2027' }}>{job.title}</div>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: sc.bg, color: sc.color, fontWeight: 700 }}>{sc.label}</span>
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>⏰ {job.scheduled_time?.slice(0,5)} · 📍 {cust?.address?.slice(0, 40)}</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>แตะเพื่อดูรายละเอียด {showDetail ? '▲' : '▼'}</div>
      </div>

      {/* Detail */}
      {showDetail && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ padding: '12px 0', fontSize: 13, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>👤 ลูกค้า: <strong>{cust?.name}</strong></div>
            <div>📱 โทร: <a href={`tel:${cust?.phone}`} style={{ color: '#0F6E56' }}>{cust?.phone}</a></div>
            <div>📍 {cust?.address}</div>
            <div><a href={`https://maps.google.com/?q=${encodeURIComponent(cust?.address || '')}`} target="_blank" rel="noreferrer" style={{ color: '#185FA5', fontSize: 12 }}>🗺️ เปิด Google Maps</a></div>
          </div>

          {/* Action buttons */}
          {status === 'assigned' && (
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>📸 ถ่ายรูปก่อนเริ่มงาน (บังคับ)</div>
              <input ref={startRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={() => handlePhotoChange('start')} />
              <button onClick={() => startRef.current?.click()} disabled={loading} style={{
                width: '100%', padding: '12px', background: '#0F6E56', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                📷 ถ่ายรูปรับงาน
              </button>
            </div>
          )}

          {status === 'in_progress' && (
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>📸 ถ่ายรูปหลังเสร็จงาน (บังคับ)</div>
              <input ref={endRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={() => handlePhotoChange('end')} />
              <button onClick={() => endRef.current?.click()} disabled={loading} style={{
                width: '100%', padding: '12px', background: '#3B6D11', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                📷 ถ่ายรูปปิดงาน
              </button>
            </div>
          )}

          {status === 'completed' && (
            <div style={{ background: '#EAF3DE', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#3B6D11', textAlign: 'center', fontWeight: 600 }}>
              ✅ งานเสร็จสมบูรณ์
            </div>
          )}

          {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('✅') ? '#3B6D11' : '#A32D2D', textAlign: 'center' }}>{msg}</div>}
          {loading && <div style={{ marginTop: 8, fontSize: 12, color: '#888', textAlign: 'center' }}>กำลังอัปโหลด...</div>}
        </div>
      )}
    </div>
  )
}
