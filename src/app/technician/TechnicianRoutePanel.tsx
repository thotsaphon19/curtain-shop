'use client'
import { useState, useEffect, useCallback } from 'react'
import TechnicianJobCard from './TechnicianJobCard'
import { Job } from '@/types'

interface Stop {
  id: string; title: string; address: string; lat?: number; lng?: number
  order: number; travel_minutes: number; travel_km: number
  arrive_time: string; customer_name?: string; scheduled_time?: string
}
interface RoutePlan { stops: Stop[]; total_km: number; total_minutes: number; ai_reason: string }

export default function TechnicianRoutePanel({ technicianId, date, initialJobs }: {
  technicianId: string; date: string
  initialJobs: (Job & { lat?: number; lng?: number; customer: { name: string; phone: string; address: string } })[]
}) {
  const [jobs, setJobs] = useState(initialJobs)
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [plan, setPlan] = useState<RoutePlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [manualNextId, setManualNextId] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const computeRoute = useCallback(async (p: { lat: number; lng: number }) => {
    setLoading(true); setErr('')
    try {
      const now = new Date()
      const start_time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      const res = await fetch('/api/map', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technician_id: technicianId, date, start_lat: p.lat, start_lng: p.lng, start_time }),
      })
      const data = await res.json()
      if (data.data) setPlan(data.data)
      else setErr(data.error || 'คำนวณเส้นทางไม่สำเร็จ')
    } catch { setErr('คำนวณเส้นทางไม่สำเร็จ') }
    setLoading(false)
  }, [technicianId, date])

  const locateAndCompute = useCallback(() => {
    if (!navigator.geolocation) { setErr('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง'); return }
    setLocating(true); setErr('')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const coords = { lat: p.coords.latitude, lng: p.coords.longitude }
        setPos(coords)
        setManualNextId(null)
        setLocating(false)
        computeRoute(coords)
      },
      () => { setLocating(false); setErr('ไม่สามารถระบุตำแหน่งปัจจุบันได้ กรุณาอนุญาตการเข้าถึงตำแหน่งของเบราว์เซอร์') },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [computeRoute])

  // คำนวณตำแหน่งปัจจุบัน + เส้นทางอัตโนมัติเมื่อเปิดหน้า
  useEffect(() => { locateAndCompute() }, [locateAndCompute])

  function handleJobStatusChange(jobId: string, newStatus: string) {
    setJobs(js => js.map(j => j.id === jobId ? { ...j, status: newStatus as Job['status'] } : j))
    if (newStatus === 'completed' && manualNextId === jobId) setManualNextId(null)
    // งานเปลี่ยนสถานะ → คำนวณเส้นทางที่เหลือใหม่จากตำแหน่งปัจจุบัน (ระบบจะขอตำแหน่งล่าสุดอีกครั้งให้แม่นยำ)
    if (newStatus === 'heading' || newStatus === 'in_progress' || newStatus === 'completed') locateAndCompute()
  }

  const activeJobs = jobs.filter(j => !['completed', 'cancelled'].includes(j.status))
  const doneCount = jobs.filter(j => j.status === 'completed').length

  // เรียงลำดับที่จะแสดง: ถ้าช่างเลือกจุดต่อไปเอง ให้ขึ้นก่อน ตามด้วยลำดับที่ AI แนะนำ
  const orderedStops = (() => {
    if (!plan) return []
    if (!manualNextId) return plan.stops
    const chosen = plan.stops.find(s => s.id === manualNextId)
    if (!chosen) return plan.stops
    return [chosen, ...plan.stops.filter(s => s.id !== manualNextId)]
  })()

  return (
    <div>
      {/* ── เส้นทางแนะนำจาก AI (อ้างอิงตำแหน่งปัจจุบัน) ── */}
      <div style={{ background:'#fff', borderRadius:14, boxShadow:'0 2px 8px rgba(0,0,0,0.08)', overflow:'hidden', marginBottom:20 }}>
        <div style={{ padding:'12px 14px', background:'var(--dark)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>🤖 เส้นทางแนะนำ (จากตำแหน่งปัจจุบัน)</div>
            <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>
              {pos ? `📍 พิกัด ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : 'กำลังระบุตำแหน่ง...'}
              {plan && ` · เหลือ ${activeJobs.length} งาน · เสร็จแล้ว ${doneCount}`}
            </div>
          </div>
          <button onClick={locateAndCompute} disabled={locating || loading} style={{
            padding:'6px 12px', background:'#0F6E56', color:'#fff', border:'none', borderRadius:8,
            fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
          }}>
            {locating ? '📍 กำลังหาตำแหน่ง...' : loading ? '⏳ กำลังคำนวณ...' : '🔄 คำนวณเส้นทางใหม่'}
          </button>
        </div>

        {err && <div style={{ padding:'10px 14px', fontSize:12, color:'#A32D2D', background:'#FFF5F5' }}>⚠️ {err}</div>}

        {orderedStops.length === 0 && !loading && !err && (
          <div style={{ padding:'20px 14px', textAlign:'center', fontSize:13, color:'#aaa' }}>
            {activeJobs.length === 0 ? '✅ งานวันนี้เสร็จหมดแล้ว' : 'กำลังเตรียมเส้นทาง...'}
          </div>
        )}

        {orderedStops.map((stop, idx) => {
          const isManual = stop.id === manualNextId
          const mapsUrl = pos
            ? `https://www.google.com/maps/dir/?api=1&origin=${pos.lat},${pos.lng}&destination=${stop.lat},${stop.lng}&travelmode=driving`
            : `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`
          return (
            <div key={stop.id} style={{
              display:'flex', gap:12, padding:'12px 14px', borderBottom:'1px solid #f5f5f5',
              background: isManual ? '#E1F5EE' : idx === 0 ? '#F0F7FF' : 'transparent',
            }}>
              <div style={{
                width:28, height:28, borderRadius:'50%', flexShrink:0,
                background: isManual ? '#0F6E56' : idx === 0 ? 'var(--blue)' : '#aaa',
                color:'#fff', fontSize:13, fontWeight:800,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>{idx + 1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:13, color:'var(--dark)' }}>
                  {stop.title}
                  {isManual && <span style={{ marginLeft:6, fontSize:10, background:'#0F6E56', color:'#fff', padding:'1px 6px', borderRadius:6 }}>เลือกเอง</span>}
                  {!isManual && idx === 0 && <span style={{ marginLeft:6, fontSize:10, background:'var(--blue)', color:'#fff', padding:'1px 6px', borderRadius:6 }}>AI แนะนำ</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                  {stop.customer_name} · {stop.address?.slice(0,35)}
                </div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
                  🚗 {stop.travel_km} กม. · {stop.travel_minutes} นาที · คาดถึง {stop.arrive_time}
                  {stop.scheduled_time && ` · นัด ${stop.scheduled_time}`}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                <a href={mapsUrl} target="_blank" rel="noreferrer" style={{
                  padding:'6px 10px', background:'#185FA5', color:'#fff', borderRadius:8,
                  fontSize:11, fontWeight:700, textDecoration:'none', textAlign:'center',
                }}>🗺️ นำทาง</a>
                {!isManual && (
                  <button onClick={() => setManualNextId(stop.id)} style={{
                    padding:'6px 10px', background:'#fff', border:'1px solid var(--border)', borderRadius:8,
                    fontSize:11, fontWeight:600, color:'var(--text-muted)', cursor:'pointer',
                  }}>เลือกจุดนี้</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── รายการงานทั้งหมดวันนี้ (ถ่ายรูป/ปิดงาน) ── */}
      <h2 style={{ fontSize:14, fontWeight:700, margin:'0 0 10px', color:'var(--dark)' }}>
        📅 งานวันนี้ ({new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short'})})
      </h2>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {jobs.map(job => <TechnicianJobCard key={job.id} job={job} onStatusChange={handleJobStatusChange} />)}
        {!jobs.length && (
          <div style={{ background:'var(--white)', borderRadius:12, padding:24, textAlign:'center', color:'var(--text-muted)', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:28, marginBottom:6 }}>✅</div>
            <div style={{ fontSize:13 }}>ไม่มีงานวันนี้</div>
          </div>
        )}
      </div>
    </div>
  )
}
