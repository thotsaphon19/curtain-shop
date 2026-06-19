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
export function optimizeRoute(opts: {
  start: LatLng
  jobs: JobPin[]
  distMatrix: DistanceResult[]
  startTime: string   // 'HH:MM'
  weights?: { priority: number; distance: number; urgency: number }
}): RoutePlan {
  const { start, jobs, distMatrix, startTime, weights = { priority: 0.5, distance: 0.3, urgency: 0.2 } } = opts
  if (jobs.length === 0) return { stops: [], total_km: 0, total_minutes: 0, ai_reason: 'ไม่มีงาน' }

  // Build distance lookup
  const dist = new Map<string, DistanceResult>()
  for (const d of distMatrix) dist.set(`${d.from_idx}_${d.to_idx}`, d)

  // All points: index 0 = start, 1..n = jobs
  const allPoints: (LatLng & { jobIdx?: number })[] = [start, ...jobs.map((j, i) => ({ lat: j.lat || 0, lng: j.lng || 0, jobIdx: i }))]
  const visited = new Set<number>()
  const order: number[] = []  // job indices in visit order
  let currentIdx = 0  // start at 0 (start point)
  let currentTime = parseTimeToMinutes(startTime)
  let totalKm = 0
  let totalMin = 0

  // Nearest-neighbor with priority scoring
  while (order.length < jobs.length) {
    let bestScore = Infinity
    let bestJobIdx = -1

    for (let j = 0; j < jobs.length; j++) {
      if (visited.has(j)) continue
      const job = jobs[j]
      if (!job.lat || !job.lng) continue  // skip ungeocoded

      // Distance from current to this job (point j+1 in allPoints)
      const dKey = `${currentIdx}_${j + 1}`
      const d = dist.get(dKey)
      const km = d?.distance_km || haversine(allPoints[currentIdx], allPoints[j + 1])
      const travelMin = d?.duration_minutes || Math.round((km / 40) * 60)

      // Scoring: lower = better
      const priorityScore = (job.priority || 3) * weights.priority          // 1=ด่วน → ต่ำ = ดี
      const distanceScore = (km / 50) * weights.distance                     // normalize
      const scheduledMin = job.scheduled_time ? parseTimeToMinutes(job.scheduled_time) : 999
      const lateScore = Math.max(0, currentTime + travelMin - scheduledMin) / 60 * weights.urgency

      const score = priorityScore + distanceScore + lateScore
      if (score < bestScore) { bestScore = score; bestJobIdx = j }
    }

    if (bestJobIdx === -1) break

    const d = dist.get(`${currentIdx}_${bestJobIdx + 1}`)
    const km = d?.distance_km || haversine(allPoints[currentIdx], allPoints[bestJobIdx + 1])
    const travelMin = d?.duration_minutes || Math.round((km / 40) * 60)
    const arriveMin = currentTime + travelMin
    const departMin = arriveMin + (jobs[bestJobIdx].estimated_duration || 120)

    order.push(bestJobIdx)
    visited.add(bestJobIdx)
    totalKm += km
    totalMin += travelMin + (jobs[bestJobIdx].estimated_duration || 120)
    currentIdx = bestJobIdx + 1
    currentTime = departMin
  }

  // Build stops
  const stops: RouteStop[] = order.map((jobIdx, orderIdx) => {
    const job = jobs[jobIdx]
    const prevPoint = orderIdx === 0 ? 0 : order[orderIdx - 1] + 1
    const d = dist.get(`${prevPoint}_${jobIdx + 1}`)
    const km = d?.distance_km || 0
    const travelMin = d?.duration_minutes || 0

    const baseStart = parseTimeToMinutes(startTime)
    const arriveAtMin = order.slice(0, orderIdx).reduce((acc, ji, oi) => {
      const dp = dist.get(`${oi === 0 ? 0 : order[oi - 1] + 1}_${ji + 1}`)
      return acc + (dp?.duration_minutes || 0) + (jobs[ji].estimated_duration || 120)
    }, baseStart) + travelMin

    return {
      ...job,
      order: orderIdx + 1,
      travel_minutes: travelMin,
      travel_km: Math.round(km * 10) / 10,
      arrive_time: minutesToTime(arriveAtMin),
      depart_time: minutesToTime(arriveAtMin + (job.estimated_duration || 120)),
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
