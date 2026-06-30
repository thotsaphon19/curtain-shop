import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { geocodeAddress, getDistanceMatrix, optimizeRoute, LatLng } from '@/lib/maps'
export const dynamic = 'force-dynamic'

// POST /api/map — geocode + optimize route for a technician on a date
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

  if (!technician_id || !date)
    return NextResponse.json({ error: 'technician_id and date required' }, { status: 400 })

  // โหลดงานของช่างวันนั้น
  const { data: jobs, error } = await supabaseAdmin
    .from('jobs')
    .select('*, customer:customers(name, address, lat, lng)')
    .eq('technician_id', technician_id)
    .eq('scheduled_date', date)
    .in('status', ['assigned', 'in_progress', 'pending'])
    .order('scheduled_time')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!jobs || jobs.length === 0) return NextResponse.json({ data: { stops: [], total_km: 0, total_minutes: 0, ai_reason: 'ไม่มีงานในวันนี้' } })

  // Geocode งานที่ยังไม่มีพิกัด
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

  // เตรียม JobPin array
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
  }))

  const validJobs = jobPins.filter(j => j.lat && j.lng)

  // Distance Matrix: start + all valid job positions
  const start: LatLng = { lat: start_lat, lng: start_lng }
  const allPoints: LatLng[] = [start, ...validJobs.map(j => ({ lat: j.lat!, lng: j.lng! }))]
  const distMatrix = await getDistanceMatrix(allPoints, allPoints)

  // Optimize route
  const plan = optimizeRoute({ start, jobs: validJobs, distMatrix, startTime: start_time, weights })

  // Save plan to DB
  const { data: saved } = await supabaseAdmin.from('route_plans').upsert({
    technician_id,
    plan_date: date,
    start_lat, start_lng, start_address,
    job_order: plan.stops.map(s => ({ job_id: s.id, order: s.order, travel_min: s.travel_minutes, dist_km: s.travel_km })),
    total_distance: plan.total_km,
    total_duration: plan.total_minutes,
    ai_suggestion: plan.ai_reason,
  }, { onConflict: 'technician_id,plan_date' }).select().single()

  // Update route_order on each job
  for (const stop of plan.stops) {
    await supabaseAdmin.from('jobs').update({
      route_order: stop.order,
      travel_duration_to: stop.travel_minutes,
      travel_distance_to: stop.travel_km,
    }).eq('id', stop.id)
  }

  return NextResponse.json({
    data: { ...plan, plan_id: saved?.id, jobs_geocoded: geocodeNeeded.length, jobs_skipped: jobs.length - validJobs.length }
  })
}

// GET /api/map — ดึงงานทั้งหมดในวันที่ระบุ (ทุกช่าง)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const technician_id = searchParams.get('technician_id')

  let q = supabaseAdmin
    .from('jobs')
    .select('*, customer:customers(name, lat, lng), technician:technicians(name, id)')
    .eq('scheduled_date', date)
    .in('status', ['assigned', 'in_progress', 'pending', 'completed'])
    .not('lat', 'is', null)

  if (technician_id) q = q.eq('technician_id', technician_id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
