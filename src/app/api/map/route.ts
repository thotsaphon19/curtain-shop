import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { geocodeAddress, getDistanceMatrix, optimizeRoute, LatLng } from '@/lib/maps'
import { getBangkokDateString } from '@/lib/date'
export const dynamic = 'force-dynamic'

// คำนวณเส้นทางให้ช่าง 1 คน (ฟังก์ชันแยกไว้ใช้ซ้ำได้ ทั้งโหมดเลือกช่างเดียว และโหมดช่างทั้งหมด)
async function planForTechnician(opts: {
  technician_id: string; date: string
  start_lat: number; start_lng: number; start_address: string; start_time: string
  weights?: { priority: number; distance: number; urgency: number }
}) {
  const { technician_id, date, start_lat, start_lng, start_address, start_time, weights } = opts

  const { data: jobs, error } = await supabaseAdmin
    .from('jobs')
    .select('*, customer:customers(id, name, phone, address, lat, lng)')
    .eq('technician_id', technician_id)
    .eq('scheduled_date', date)
    .in('status', ['assigned', 'heading', 'in_progress', 'pending'])
    .order('scheduled_time')

  if (error) throw new Error(error.message)
  if (!jobs || jobs.length === 0) return { stops: [], total_km: 0, total_minutes: 0, ai_reason: 'ไม่มีงานในวันนี้', jobs_geocoded: 0, jobs_skipped: 0 }

  const geocodeNeeded = jobs.filter(j => !j.lat || !j.lng)
  for (const job of geocodeNeeded) {
    const addr = job.address || (job as unknown as {customer:{address:string}}).customer?.address
    if (!addr) continue
    const coords = await geocodeAddress(addr)
    if (coords) {
      await supabaseAdmin.from('jobs').update({ lat: coords.lat, lng: coords.lng, geocoded_at: new Date().toISOString() }).eq('id', job.id)
      job.lat = coords.lat; job.lng = coords.lng
    }
  }

  const jobPins = jobs.map(j => ({
    id: j.id,
    title: j.title,
    address: j.address,
    lat: j.lat || (j as unknown as {customer:{lat:number}}).customer?.lat,
    lng: j.lng || (j as unknown as {customer:{lng:number}}).customer?.lng,
    scheduled_time: j.scheduled_time?.slice(0, 5),
    priority: j.priority || 3,
    estimated_duration: j.estimated_duration || 120,
    status: j.status,
    customer_name: (j as unknown as {customer:{name:string}}).customer?.name,
    customer_phone: (j as unknown as {customer:{phone:string}}).customer?.phone,
    customer_id: (j as unknown as {customer:{id:string}}).customer?.id,
  }))

  const validJobs = jobPins.filter(j => j.lat && j.lng)

  const start: LatLng = { lat: start_lat, lng: start_lng }
  const allPoints: LatLng[] = [start, ...validJobs.map(j => ({ lat: j.lat!, lng: j.lng! }))]
  const distMatrix = await getDistanceMatrix(allPoints, allPoints)

  const plan = optimizeRoute({ start, jobs: validJobs, distMatrix, startTime: start_time, weights })

  const { data: saved } = await supabaseAdmin.from('route_plans').upsert({
    technician_id,
    plan_date: date,
    start_lat, start_lng, start_address,
    job_order: plan.stops.map(s => ({ job_id: s.id, order: s.order, travel_min: s.travel_minutes, dist_km: s.travel_km })),
    total_distance: plan.total_km,
    total_duration: plan.total_minutes,
    ai_suggestion: plan.ai_reason,
  }, { onConflict: 'technician_id,plan_date' }).select().single()

  for (const stop of plan.stops) {
    await supabaseAdmin.from('jobs').update({
      route_order: stop.order,
      travel_duration_to: stop.travel_minutes,
      travel_distance_to: stop.travel_km,
    }).eq('id', stop.id)
  }

  return { ...plan, plan_id: saved?.id, jobs_geocoded: geocodeNeeded.length, jobs_skipped: jobs.length - validJobs.length }
}

// POST /api/map — วางเส้นทางให้ช่าง 1 คน (ระบุ technician_id) หรือ "ช่างทั้งหมด" พร้อมกัน (ไม่ระบุ technician_id)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    technician_id,
    date,
    start_lat = 13.7563,   // default: Bangkok center
    start_lng = 100.5018,
    start_address = 'ร้านผ้าม่าน',
    start_time = '08:00',
    weights,
  } = body

  if (!date)
    return NextResponse.json({ error: 'date required' }, { status: 400 })

  // ── โหมดช่างคนเดียว (เลือกช่างเจาะจงจากดรอปดาวน์) ─────────────────────────
  if (technician_id) {
    try {
      const plan = await planForTechnician({ technician_id, date, start_lat, start_lng, start_address, start_time, weights })
      return NextResponse.json({ data: plan })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
  }

  // ── โหมด "ช่างทั้งหมด" — หาว่าวันนี้ใครมีงานบ้าง แล้ววางเส้นทางให้ทีละคน ──────
  const { data: techsWithJobs } = await supabaseAdmin
    .from('jobs')
    .select('technician_id, technician:technicians(id, name)')
    .eq('scheduled_date', date)
    .in('status', ['assigned', 'heading', 'in_progress', 'pending'])
    .not('technician_id', 'is', null)

  const uniqueTechIds = Array.from(new Set((techsWithJobs || []).map(j => j.technician_id).filter(Boolean)))
  const techNameMap = new Map<string, string>()
  ;(techsWithJobs || []).forEach(j => {
    const t = (j as unknown as { technician?: { id: string; name: string } }).technician
    if (t?.id) techNameMap.set(t.id, t.name)
  })

  if (uniqueTechIds.length === 0) {
    return NextResponse.json({ data: { multi: true, plans: [] } })
  }

  const plans = []
  for (const techId of uniqueTechIds) {
    try {
      const plan = await planForTechnician({ technician_id: techId as string, date, start_lat, start_lng, start_address, start_time, weights })
      plans.push({ technician_id: techId, technician_name: techNameMap.get(techId as string) || 'ไม่ทราบชื่อ', ...plan })
    } catch (e) {
      plans.push({
        technician_id: techId, technician_name: techNameMap.get(techId as string) || 'ไม่ทราบชื่อ',
        stops: [], total_km: 0, total_minutes: 0, ai_reason: `เกิดข้อผิดพลาด: ${e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'}`,
      })
    }
  }

  return NextResponse.json({ data: { multi: true, plans } })
}

// GET /api/map — ดึงงานทั้งหมดในวันที่ระบุ (ทุกช่าง)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || getBangkokDateString()
  const technician_id = searchParams.get('technician_id')

  let q = supabaseAdmin
    .from('jobs')
    .select('*, customer:customers(id, name, phone, lat, lng), technician:technicians(name, id)')
    .eq('scheduled_date', date)
    .in('status', ['assigned', 'heading', 'in_progress', 'pending', 'completed'])
    .not('lat', 'is', null)

  if (technician_id) q = q.eq('technician_id', technician_id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
