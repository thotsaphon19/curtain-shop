// ─── Types ───────────────────────────────────────────────────────────────────
export interface LatLng { lat: number; lng: number }

export interface JobPin {
  id: string
  title: string
  address: string
  lat?: number
  lng?: number
  scheduled_time?: string
  priority?: number
  estimated_duration?: number
  status?: string
  customer_name?: string
  customer_phone?: string
  customer_id?: string
  technician_name?: string
}

export interface RouteStop extends JobPin {
  order: number
  travel_minutes: number
  travel_km: number
  arrive_time: string   // HH:MM
  depart_time: string
  score?: number        // AI scoring
}

export interface RoutePlan {
  stops: RouteStop[]
  total_km: number
  total_minutes: number
  ai_reason: string
}

// ─── Geocode single address via Google Geocoding API ─────────────────────────
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!key) return null
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ' ประเทศไทย')}&key=${key}&language=th`
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 'OK' && data.results[0]) {
      const loc = data.results[0].geometry.location
      return { lat: loc.lat, lng: loc.lng }
    }
  } catch { /* ignore */ }
  return null
}

// ─── Distance Matrix — batch query ──────────────────────────────────────────
export interface DistanceResult {
  from_idx: number
  to_idx: number
  distance_km: number
  duration_minutes: number
}

export async function getDistanceMatrix(
  origins: LatLng[],
  destinations: LatLng[]
): Promise<DistanceResult[]> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!key || origins.length === 0 || destinations.length === 0) return []

  const origStr = origins.map(o => `${o.lat},${o.lng}`).join('|')
  const destStr = destinations.map(d => `${d.lat},${d.lng}`).join('|')
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${origStr}&destinations=${destStr}` +
    `&mode=driving&language=th&key=${key}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    const results: DistanceResult[] = []
    if (data.status !== 'OK') return []

    data.rows.forEach((row: GoogleMatrixRow, i: number) => {
      row.elements.forEach((el: GoogleMatrixElement, j: number) => {
        if (el.status === 'OK') {
          results.push({
            from_idx: i,
            to_idx: j,
            distance_km: el.distance.value / 1000,
            duration_minutes: Math.round(el.duration.value / 60),
          })
        }
      })
    })
    return results
  } catch { return [] }
}

// ─── Nearest Neighbor TSP with priority scoring ───────────────────────────
// คะแนน = priority_weight + distance_weight + time_weight
// ยิ่งคะแนนน้อย ยิ่งควรไปก่อน
//
// วิธีคำนวณ: แบ่งงานเป็น 2 กลุ่ม
//  1) งานที่ลูกค้านัดเวลาไว้ชัดเจน (scheduled_time) — ใช้เวลานัดเป็น "โครงหลัก" ของเส้นทาง
//     เรียงตามเวลานัดก่อน-หลังเสมอ ไม่ให้ปนกันจนไปถึงช้ากว่าที่นัดไว้มาก (บั๊กเดิม: ระบบ
//     เลือกงานที่ใกล้ที่สุดก่อนโดยไม่สนเวลานัด ทำให้งานนัด 09:00 ถูกไปเยี่ยมหลังบ่ายโมง)
//  2) งานที่ยืดหยุ่นได้ (ไม่ได้นัดเวลา) — แทรกเข้าไปในช่องว่างระหว่างงานกลุ่ม 1 ที่ทำให้
//     ระยะทางรวมเพิ่มน้อยที่สุด (cheapest insertion) โดยงานที่มีความสำคัญสูงกว่าจะได้แทรกก่อน
export function optimizeRoute(opts: {
  start: LatLng
  jobs: JobPin[]
  distMatrix: DistanceResult[]
  startTime: string   // 'HH:MM'
  weights?: { priority: number; distance: number; urgency: number }
}): RoutePlan {
  const { start, jobs, startTime, distMatrix } = opts
  const validJobs = jobs.filter(j => j.lat && j.lng)
  if (validJobs.length === 0) return { stops: [], total_km: 0, total_minutes: 0, ai_reason: 'ไม่มีงาน' }

  // Build distance lookup — index 0 = start, 1..n = validJobs (ตรงกับลำดับที่ /api/map ส่งเข้ามาคำนวณ distMatrix)
  const dist = new Map<string, DistanceResult>()
  for (const d of distMatrix) dist.set(`${d.from_idx}_${d.to_idx}`, d)
  const allPoints: LatLng[] = [start, ...validJobs.map(j => ({ lat: j.lat!, lng: j.lng! }))]

  function travel(fromPointIdx: number, toPointIdx: number): { km: number; min: number } {
    const d = dist.get(`${fromPointIdx}_${toPointIdx}`)
    if (d) return { km: d.distance_km, min: d.duration_minutes }
    const km = haversine(allPoints[fromPointIdx], allPoints[toPointIdx])
    return { km, min: Math.round((km / 40) * 60) }
  }

  // ── 1) โครงหลัก: งานที่มีเวลานัด เรียงตามเวลานัดก่อน-หลัง ──────────────────
  const timedIdx = validJobs
    .map((j, i) => ({ j, i }))
    .filter(x => !!x.j.scheduled_time)
    .sort((a, b) => parseTimeToMinutes(a.j.scheduled_time!) - parseTimeToMinutes(b.j.scheduled_time!))
    .map(x => x.i)

  // ── 2) งานยืดหยุ่น เรียงตามความสำคัญ (ด่วนกว่า = แทรกก่อน) ────────────────
  const flexibleIdx = validJobs
    .map((j, i) => ({ j, i }))
    .filter(x => !x.j.scheduled_time)
    .sort((a, b) => (a.j.priority || 3) - (b.j.priority || 3))
    .map(x => x.i)

  const route: number[] = [...timedIdx]

  // จำลองการเดินเส้นทางทั้งหมด คืนระยะทางรวม + จำนวนนาทีที่ "สาย" กว่าที่นัดไว้รวมทุกจุด
  // (จุดที่ไม่ได้นัดเวลาไม่มีผลต่อ lateness)
  function simulateRoute(candidateRoute: number[]): { km: number; lateness: number } {
    let point = 0
    let time = parseTimeToMinutes(startTime)
    let km = 0
    let lateness = 0
    for (const idx of candidateRoute) {
      const job = validJobs[idx]
      const t = travel(point, idx + 1)
      const arrive = time + t.min
      if (job.scheduled_time) lateness += Math.max(0, arrive - parseTimeToMinutes(job.scheduled_time))
      km += t.km
      point = idx + 1
      time = arrive + (job.estimated_duration || 120)
    }
    return { km, lateness }
  }

  // แทรกงานยืดหยุ่นทีละงาน ณ ตำแหน่งที่ดีที่สุด — ให้น้ำหนัก "ความสาย" ของงานที่มีเวลานัด
  // มากกว่าระยะทางมาก เพื่อป้องกันบั๊กเดิม (แทรกงานใกล้ๆ ก่อนจนงานที่นัดเวลาไว้ไปสายหลายชั่วโมง)
  const LATE_PENALTY_KM_PER_MIN = 3
  for (const idx of flexibleIdx) {
    let bestPos = route.length
    let bestCost = Infinity
    for (let pos = 0; pos <= route.length; pos++) {
      const candidate = [...route.slice(0, pos), idx, ...route.slice(pos)]
      const { km, lateness } = simulateRoute(candidate)
      const cost = km + lateness * LATE_PENALTY_KM_PER_MIN
      if (cost < bestCost) { bestCost = cost; bestPos = pos }
    }
    route.splice(bestPos, 0, idx)
  }

  // ── เดินตามลำดับ route จริง คำนวณเวลาถึง/ระยะทางสะสม ────────────────────
  let currentPoint = 0
  let currentTime = parseTimeToMinutes(startTime)
  let totalKm = 0
  let totalMin = 0

  const stops: RouteStop[] = route.map((jobIdx, orderIdx) => {
    const job = validJobs[jobIdx]
    const toPoint = jobIdx + 1
    const t = travel(currentPoint, toPoint)
    const arriveMin = currentTime + t.min
    const departMin = arriveMin + (job.estimated_duration || 120)

    totalKm += t.km
    totalMin += t.min + (job.estimated_duration || 120)
    currentPoint = toPoint
    currentTime = departMin

    return {
      ...job,
      order: orderIdx + 1,
      travel_minutes: t.min,
      travel_km: Math.round(t.km * 10) / 10,
      arrive_time: minutesToTime(arriveMin),
      depart_time: minutesToTime(departMin),
      score: undefined,
    }
  })

  // AI reason text
  const aiReason = buildAIReason(stops, jobs)

  return {
    stops,
    total_km: Math.round(totalKm * 10) / 10,
    total_minutes: totalMin,
    ai_reason: aiReason,
  }
}


// ─── Build AI reasoning text ─────────────────────────────────────────────────
function buildAIReason(stops: RouteStop[], allJobs: JobPin[]): string {
  if (stops.length === 0) return 'ไม่มีงานในวันนี้'

  const lines: string[] = ['🤖 AI วิเคราะห์เส้นทางที่ดีที่สุด:\n']

  stops.forEach((s, i) => {
    const priority = s.priority || 3
    const pLabel = priority <= 1 ? '🔴 ด่วนมาก' : priority === 2 ? '🟠 ด่วน' : priority === 3 ? '🟡 ปกติ' : '🟢 ยืดหยุ่นได้'
    const late = s.scheduled_time && s.arrive_time > s.scheduled_time ? ' ⚠️ อาจสายนิดหน่อย' : ''
    lines.push(
      `จุดที่ ${i + 1}: ${s.title}\n` +
      `  ⏰ นัด ${s.scheduled_time || '-'} → ถึง ${s.arrive_time}${late}\n` +
      `  🚗 เดินทาง ${s.travel_km} กม. / ${s.travel_minutes} นาที\n` +
      `  ${pLabel}`
    )
  })

  // Check if any high-priority job might be late
  const lateJobs = stops.filter(s => s.scheduled_time && s.arrive_time > s.scheduled_time)
  if (lateJobs.length > 0) {
    lines.push(`\n⚠️ แจ้งเตือน: งาน ${lateJobs.map(j => j.title).join(', ')} อาจถึงหลังเวลานัด ควรแจ้งลูกค้าล่วงหน้า`)
  }

  // Lunch break suggestion
  const mealTime = stops.findIndex(s => {
    const arrive = parseTimeToMinutes(s.arrive_time)
    return arrive >= parseTimeToMinutes('11:30') && arrive <= parseTimeToMinutes('13:30')
  })
  if (mealTime >= 0) {
    lines.push(`\n🍽️ แนะนำพักกินข้าวหลังงานที่ ${mealTime + 1} (${stops[mealTime].arrive_time})`)
  } else {
    lines.push(`\n🍽️ ควรวางแผนพักกินข้าวช่วง 12:00–13:00 ระหว่างงาน`)
  }

  return lines.join('\n')
}

// ─── Haversine fallback ───────────────────────────────────────────────────────
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// ─── Google API Types ─────────────────────────────────────────────────────────
interface GoogleMatrixRow { elements: GoogleMatrixElement[] }
interface GoogleMatrixElement {
  status: string
  distance: { value: number; text: string }
  duration: { value: number; text: string }
}
