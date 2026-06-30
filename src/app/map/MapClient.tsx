'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { minutesToTime } from '@/lib/maps'

interface JobData {
  id: string; title: string; address: string
  lat?: number; lng?: number
  scheduled_time?: string; priority?: number; estimated_duration?: number
  status?: string; route_order?: number; travel_minutes?: number; travel_km?: number
  customer?: { name: string; lat?: number; lng?: number }
  technician?: { name: string; id: string }
}

interface Technician { id: string; name: string }
interface RoutePlan {
  id: string; technician_id: string; ai_suggestion: string
  total_distance: number; total_duration: number
  job_order: { job_id: string; order: number; travel_min: number; dist_km: number }[]
  technician?: { name: string }
}

interface Stop {
  id: string; title: string; address: string; lat?: number; lng?: number
  order: number; travel_minutes: number; travel_km: number
  arrive_time: string; depart_time: string; priority?: number
  status?: string; customer_name?: string; scheduled_time?: string
}

interface Props {
  initialJobs: JobData[]; technicians: Technician[]
  routePlans: RoutePlan[]; selectedDate: string; googleMapsKey: string
}

const PRIORITY_CONFIG = [
  { value: 1, label: '🔴 ด่วนมาก', color: '#E24B4A' },
  { value: 2, label: '🟠 ด่วน', color: '#EF9F27' },
  { value: 3, label: '🟡 ปกติ', color: '#639922' },
  { value: 4, label: '🟢 ยืดหยุ่น', color: '#185FA5' },
  { value: 5, label: '⚪ ต่ำ', color: '#888' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: '#EF9F27', assigned: '#185FA5', in_progress: '#0F6E56',
  completed: '#3B6D11', overdue: '#E24B4A',
}

export default function MapClient({ initialJobs, technicians, routePlans, selectedDate, googleMapsKey }: Props) {
  const router = useRouter()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  const [jobs, setJobs] = useState<JobData[]>(initialJobs)
  const [selectedTech, setSelectedTech] = useState<string>('')
  const [date, setDate] = useState(selectedDate)
  const [startTime, setStartTime] = useState('08:00')
  const [startAddress, setStartAddress] = useState('ร้านผ้าม่าน')
  const [optimizing, setOptimizing] = useState(false)
  const [plan, setPlan] = useState<{ stops: Stop[]; total_km: number; total_minutes: number; ai_reason: string } | null>(null)
  const [activeStop, setActiveStop] = useState<string | null>(null)
  const [panel, setPanel] = useState<'list' | 'ai' | 'route'>('list')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [existingPlan, setExistingPlan] = useState<RoutePlan | null>(routePlans[0] || null)

  // Load Google Maps
  useEffect(() => {
    if (!googleMapsKey || typeof window === 'undefined') return
    if ((window as unknown as {google?: unknown}).google) { setMapLoaded(true); return }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&language=th&region=TH`
    script.async = true
    script.onload = () => setMapLoaded(true)
    document.head.appendChild(script)
  }, [googleMapsKey])

  // Init map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstance.current) return
    const g = (window as unknown as {google: typeof google}).google
    mapInstance.current = new g.maps.Map(mapRef.current, {
      center: { lat: 13.7563, lng: 100.5018 },
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_CENTER },
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
      ],
    })
    infoWindowRef.current = new g.maps.InfoWindow()
  }, [mapLoaded])

  // Render markers
  const renderMarkers = useCallback(() => {
    if (!mapInstance.current || !mapLoaded) return
    const g = (window as unknown as {google: typeof google}).google

    // Clear old markers and polyline
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    if (polylineRef.current) polylineRef.current.setMap(null)

    const filteredJobs = selectedTech ? jobs.filter(j => j.technician?.id === selectedTech) : jobs
    const bounds = new g.maps.LatLngBounds()
    let hasBounds = false

    // Use route order if plan exists
    const ordered = plan ? plan.stops : filteredJobs.map((j, i) => ({
      ...j, order: j.route_order || i + 1, travel_minutes: 0, travel_km: 0,
      arrive_time: j.scheduled_time || '--:--', depart_time: '--:--',
      customer_name: j.customer?.name,
    }))

    const routePoints: google.maps.LatLng[] = []

    ordered.forEach((stop) => {
      const lat = stop.lat
      const lng = stop.lng
      if (!lat || !lng) return

      const pos = { lat, lng }
      const prio = stop.priority || 3
      const prioCfg = PRIORITY_CONFIG.find(p => p.value === prio) || PRIORITY_CONFIG[2]
      const statusColor = STATUS_COLORS[stop.status || ''] || '#888'
      const isActive = activeStop === stop.id
      const orderNum = stop.order || '?'

      // Custom SVG marker
      const svgContent = `
        <svg width="${isActive ? 52 : 44}" height="${isActive ? 64 : 54}" viewBox="0 0 44 54" xmlns="http://www.w3.org/2000/svg">
          <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/></filter>
          <path d="M22 2C12.06 2 4 10.06 4 20c0 13.25 18 32 18 32s18-18.75 18-32C40 10.06 31.94 2 22 2z"
            fill="${statusColor}" stroke="white" stroke-width="2" filter="url(#shadow)"/>
          <circle cx="22" cy="20" r="12" fill="white"/>
          <text x="22" y="25" text-anchor="middle" font-size="${orderNum.toString().length > 1 ? '11' : '13'}"
            font-weight="800" fill="${prioCfg.color}" font-family="system-ui">${orderNum}</text>
        </svg>
      `

      const marker = new g.maps.Marker({
        position: pos,
        map: mapInstance.current!,
        icon: { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgContent)}`, anchor: new g.maps.Point(22, 54) },
        title: stop.title,
        zIndex: isActive ? 999 : 100,
      })

      const infoContent = `
        <div style="font-family:system-ui;min-width:200px;max-width:260px;padding:4px">
          <div style="font-weight:800;font-size:14px;color:#0F2027;margin-bottom:4px">${stop.title}</div>
          <div style="font-size:12px;color:#666;margin-bottom:6px">${stop.address}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
            <span style="background:${statusColor};color:white;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">
              ${stop.status || ''}
            </span>
            <span style="background:${prioCfg.color}20;color:${prioCfg.color};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">
              ${prioCfg.label}
            </span>
          </div>
          ${stop.arrive_time && stop.arrive_time !== '--:--' ? `
          <div style="font-size:12px;color:#555">
            ⏰ นัด ${stop.scheduled_time || '-'} → ถึง <strong>${stop.arrive_time}</strong>
          </div>` : ''}
          ${stop.travel_km ? `<div style="font-size:11px;color:#888;margin-top:3px">🚗 ${stop.travel_km} กม. / ${stop.travel_minutes} นาที</div>` : ''}
          ${stop.customer_name ? `<div style="font-size:11px;color:#888">👤 ${stop.customer_name}</div>` : ''}
          <a href="/jobs/${stop.id}" style="display:block;margin-top:8px;color:#0F6E56;font-size:12px;font-weight:700">ดูรายละเอียด →</a>
        </div>
      `

      marker.addListener('click', () => {
        infoWindowRef.current?.setContent(infoContent)
        infoWindowRef.current?.open(mapInstance.current!, marker)
        setActiveStop(stop.id)
        setPanel('route')
      })

      markersRef.current.push(marker)
      bounds.extend(pos)
      hasBounds = true
      routePoints.push(new g.maps.LatLng(lat, lng))
    })

    // Draw route polyline
    if (plan && routePoints.length > 1) {
      polylineRef.current = new g.maps.Polyline({
        path: routePoints,
        geodesic: true,
        strokeColor: '#0F6E56',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        icons: [{
          icon: { path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillColor: '#0F6E56', fillOpacity: 1, strokeWeight: 0 },
          offset: '50%', repeat: '120px',
        }],
        map: mapInstance.current!,
      })
    }

    if (hasBounds) mapInstance.current!.fitBounds(bounds, 60)
  }, [jobs, selectedTech, plan, activeStop, mapLoaded])

  useEffect(() => { renderMarkers() }, [renderMarkers])

  // Optimize route
  async function optimize() {
    if (!selectedTech) return alert('กรุณาเลือกช่างก่อน')
    setOptimizing(true)
    const res = await fetch('/api/map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ technician_id: selectedTech, date, start_time: startTime, start_address: startAddress }),
    })
    const data = await res.json()
    if (data.data) {
      setPlan(data.data)
      setPanel('ai')
    }
    setOptimizing(false)
  }

  // Load jobs for selected date
  async function loadJobs() {
    const url = `/api/map?date=${date}${selectedTech ? `&technician_id=${selectedTech}` : ''}`
    const res = await fetch(url)
    const data = await res.json()
    setJobs(data.data || [])
    router.replace(`/map?date=${date}`, { scroll: false })
  }

  const filteredJobs = selectedTech ? jobs.filter(j => j.technician?.id === selectedTech) : jobs
  const displayStops = plan?.stops || filteredJobs.map((j, i) => ({
    ...j, order: j.route_order || i + 1, travel_minutes: j.travel_minutes || 0,
    travel_km: j.travel_km || 0,
    arrive_time: j.scheduled_time || '--:--', depart_time: '--:--',
    customer_name: j.customer?.name,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 56px)', gap: 0 }}>

      {/* Top toolbar */}
      <div style={{
        background: '#fff', padding: '10px 16px', borderBottom: '1px solid #eee',
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
      }}>
        <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0F2027', whiteSpace: 'nowrap' }}>🗺️ แผนที่หน้างาน</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
        <select value={selectedTech} onChange={e => setSelectedTech(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, minWidth: 140 }}>
          <option value="">— ช่างทั้งหมด —</option>
          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={loadJobs} style={{ padding: '7px 14px', background: '#E6F1FB', color: '#185FA5', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          🔄 โหลด
        </button>
        <div style={{ flex: 1 }} />
        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, width: 100 }} />
        <button onClick={optimize} disabled={optimizing || !selectedTech}
          style={{
            padding: '8px 18px', background: optimizing ? '#aaa' : '#0F6E56', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: optimizing ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            opacity: !selectedTech ? 0.5 : 1,
          }}>
          {optimizing ? '⏳ คำนวณ...' : '🤖 AI วางเส้นทาง'}
        </button>
      </div>

      {/* Main area: map + side panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Map */}
        <div ref={mapRef} style={{ flex: 1, position: 'relative' }}>
          {!googleMapsKey && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', background: '#F5F6FA', zIndex: 5,
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F2027', marginBottom: 6 }}>ตั้งค่า Google Maps API Key</div>
              <div style={{ fontSize: 13, color: '#888', textAlign: 'center', maxWidth: 320 }}>
                เพิ่ม <code style={{ background: '#eee', padding: '2px 6px', borderRadius: 4 }}>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> ใน .env.local
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: '#aaa' }}>ระหว่างนี้ระบบจะคำนวณระยะทางด้วย Haversine formula</div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div style={{
          width: 340, background: '#fff', borderLeft: '1px solid #eee',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Panel tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #eee', flexShrink: 0 }}>
            {[
              { key: 'list', icon: '📋', label: `งาน (${filteredJobs.length})` },
              { key: 'route', icon: '🚗', label: 'เส้นทาง' },
              { key: 'ai', icon: '🤖', label: 'AI' },
            ].map(t => (
              <button key={t.key} onClick={() => setPanel(t.key as typeof panel)} style={{
                flex: 1, padding: '10px 4px', border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: panel === t.key ? '2px solid #0F6E56' : '2px solid transparent',
                color: panel === t.key ? '#0F6E56' : '#888', fontSize: 12, fontWeight: panel === t.key ? 700 : 400,
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* Jobs list */}
            {panel === 'list' && (
              <div>
                {filteredJobs.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📍</div>
                    <div style={{ fontSize: 13 }}>ไม่มีงานในวันที่เลือก</div>
                  </div>
                ) : filteredJobs.map(job => {
                  const prio = PRIORITY_CONFIG.find(p => p.value === (job.priority || 3)) || PRIORITY_CONFIG[2]
                  const statusColor = STATUS_COLORS[job.status || ''] || '#888'
                  const hasCoords = !!(job.lat || job.customer?.lat)
                  return (
                    <div key={job.id}
                      onClick={() => { setActiveStop(job.id); renderMarkers() }}
                      style={{
                        padding: '12px 14px', borderBottom: '1px solid #f5f5f5',
                        cursor: 'pointer', background: activeStop === job.id ? '#E1F5EE' : '#fff',
                        transition: 'background 0.1s',
                      }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{
                          minWidth: 28, height: 28, borderRadius: '50%', background: statusColor,
                          color: '#fff', fontSize: 12, fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{job.route_order || '?'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#0F2027', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                          <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.address}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, background: prio.color + '20', color: prio.color, padding: '1px 6px', borderRadius: 6, fontWeight: 600 }}>{prio.label}</span>
                            <span style={{ fontSize: 10, color: '#888' }}>⏰ {job.scheduled_time?.slice(0, 5) || '-'}</span>
                            {!hasCoords && <span style={{ fontSize: 10, color: '#A32D2D', fontWeight: 600 }}>⚠️ ไม่มีพิกัด</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Route stops */}
            {panel === 'route' && (
              <div>
                {!plan && !existingPlan ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🚗</div>
                    <div style={{ fontSize: 13, marginBottom: 12 }}>กด AI วางเส้นทาง เพื่อคำนวณ</div>
                  </div>
                ) : (
                  <div>
                    {/* Summary bar */}
                    <div style={{ padding: '10px 14px', background: '#E1F5EE', borderBottom: '1px solid #c8eedf' }}>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                        <span>📍 {displayStops.length} จุด</span>
                        <span>🚗 {plan?.total_km || existingPlan?.total_distance || 0} กม.</span>
                        <span>⏱ {Math.round((plan?.total_minutes || existingPlan?.total_duration || 0) / 60 * 10) / 10} ชม.</span>
                      </div>
                    </div>

                    {displayStops.map((stop, i) => {
                      const prio = PRIORITY_CONFIG.find(p => p.value === (stop.priority || 3)) || PRIORITY_CONFIG[2]
                      const isLate = stop.scheduled_time && stop.arrive_time !== '--:--' && stop.arrive_time > stop.scheduled_time
                      const isMeal = i > 0 && stop.arrive_time !== '--:--' && stop.arrive_time >= '11:30' && stop.arrive_time <= '13:30'
                        && displayStops[i - 1].arrive_time < '12:00'

                      return (
                        <div key={stop.id}>
                          {/* Meal break indicator */}
                          {isMeal && (
                            <div style={{ padding: '6px 14px', background: '#FAEEDA', borderBottom: '1px solid #f0c070', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#854F0B', fontWeight: 600 }}>
                              🍽️ แนะนำพักกินข้าวก่อนไปจุดถัดไป
                            </div>
                          )}

                          {/* Travel indicator */}
                          {stop.travel_km > 0 && (
                            <div style={{ padding: '4px 14px 4px 28px', background: '#F8F9FA', display: 'flex', gap: 10, fontSize: 11, color: '#888' }}>
                              <span>⬇</span>
                              <span>🚗 {stop.travel_km} กม.</span>
                              <span>⏱ {stop.travel_minutes} นาที</span>
                            </div>
                          )}

                          <div
                            onClick={() => { setActiveStop(stop.id); renderMarkers() }}
                            style={{
                              padding: '12px 14px', borderBottom: '1px solid #f5f5f5',
                              cursor: 'pointer', background: activeStop === stop.id ? '#E6F1FB' : '#fff',
                            }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <div style={{
                                minWidth: 28, height: 28, borderRadius: '50%', background: prio.color,
                                color: '#fff', fontSize: 13, fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              }}>{stop.order}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#0F2027' }}>{stop.title}</div>
                                <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{stop.address}</div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11 }}>
                                  <span style={{ color: isLate ? '#A32D2D' : '#0F6E56', fontWeight: 600 }}>
                                    ถึง {stop.arrive_time} {isLate ? '⚠️' : '✅'}
                                  </span>
                                  <span style={{ color: '#888' }}>ออก {stop.depart_time}</span>
                                </div>
                                {stop.customer_name && <div style={{ fontSize: 11, color: '#888' }}>👤 {stop.customer_name}</div>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* AI panel */}
            {panel === 'ai' && (
              <div style={{ padding: 14 }}>
                {plan ? (
                  <>
                    <div style={{ background: '#E1F5EE', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0F6E56', marginBottom: 4 }}>🤖 AI วิเคราะห์เส้นทาง</div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#555' }}>
                        <span>📍 {plan.stops.length} จุด</span>
                        <span>🚗 {plan.total_km} กม.</span>
                        <span>⏱ ~{Math.floor(plan.total_minutes / 60)} ชม. {plan.total_minutes % 60} นาที</span>
                      </div>
                    </div>
                    <pre style={{
                      background: '#F8F9FA', borderRadius: 10, padding: '12px 14px',
                      fontSize: 12, lineHeight: 1.7, color: '#333',
                      whiteSpace: 'pre-wrap', fontFamily: 'system-ui',
                      border: '1px solid #eee', maxHeight: 400, overflowY: 'auto',
                    }}>{plan.ai_reason}</pre>

                    {/* Warnings */}
                    {plan.stops.some(s => s.scheduled_time && s.arrive_time > s.scheduled_time) && (
                      <div style={{ marginTop: 10, background: '#FCEBEB', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#A32D2D' }}>
                        <strong>⚠️ แจ้งเตือน:</strong> มีงานที่อาจถึงหลังเวลานัด ควรแจ้งลูกค้าล่วงหน้าก่อน
                      </div>
                    )}

                    <button onClick={() => setPanel('route')} style={{
                      width: '100%', marginTop: 12, padding: '10px', background: '#0F6E56',
                      color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}>ดูเส้นทางทั้งหมด →</button>
                  </>
                ) : existingPlan ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0F2027', marginBottom: 8 }}>
                      🤖 แผนล่าสุด — {existingPlan.technician?.name}
                    </div>
                    <pre style={{
                      background: '#F8F9FA', borderRadius: 10, padding: '12px 14px',
                      fontSize: 12, lineHeight: 1.7, color: '#333',
                      whiteSpace: 'pre-wrap', fontFamily: 'system-ui',
                    }}>{existingPlan.ai_suggestion}</pre>
                  </div>
                ) : (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                    <div style={{ fontSize: 13 }}>กด AI วางเส้นทาง เพื่อวิเคราะห์</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
