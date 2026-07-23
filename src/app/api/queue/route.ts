import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getBangkokDateString } from '@/lib/date'
export const dynamic = 'force-dynamic'

// GET - ดึง queue slots ตามวันที่ (ทุกช่าง หรือช่างเดียว)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date          = searchParams.get('date') || getBangkokDateString()
  const technician_id = searchParams.get('technician_id')
  const range_start   = searchParams.get('range_start') || date
  const range_end     = searchParams.get('range_end')   || date

  let q = supabaseAdmin
    .from('queue_slots')
    .select('*, job:jobs(id,title,address,status,customer:customers(name,phone)), technician:technicians(id,name)')
    .gte('slot_date', range_start)
    .lte('slot_date', range_end)
    .order('slot_date').order('slot_start')

  if (technician_id) q = q.eq('technician_id', technician_id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

// POST - generate slots สำหรับช่าง 1 คน 1 สัปดาห์ หรือ assign job เข้า slot
export async function POST(req: NextRequest) {
  const body = await req.json()

  // ── Generate slots for a technician ──────────────────────────────────────
  if (body.action === 'generate') {
    const { technician_id, date_from, date_to } = body
    if (!technician_id || !date_from || !date_to)
      return NextResponse.json({ error: 'technician_id, date_from, date_to required' }, { status: 400 })

    // Get working schedule
    const { data: sched } = await supabaseAdmin
      .from('technician_schedules').select('*').eq('technician_id', technician_id).single()

    const workDays  = sched?.work_days  || [1,2,3,4,5,6]
    const startTime = sched?.start_time || '08:00'
    const endTime   = sched?.end_time   || '18:00'
    const slotMin   = sched?.slot_duration || 120

    const slots: object[] = []
    const cur = new Date(date_from)
    const end = new Date(date_to)

    while (cur <= end) {
      const dow = cur.getDay()
      if (workDays.includes(dow)) {
        const dateStr = cur.toISOString().split('T')[0]
        const [sh, sm] = startTime.split(':').map(Number)
        const [eh, em] = endTime.split(':').map(Number)
        let slotStartMin = sh * 60 + sm
        const endMin = eh * 60 + em

        while (slotStartMin + slotMin <= endMin) {
          const slotEndMin = slotStartMin + slotMin
          const fmt = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
          slots.push({
            technician_id,
            slot_date:  dateStr,
            slot_start: fmt(slotStartMin),
            slot_end:   fmt(slotEndMin),
            status: 'available',
          })
          slotStartMin = slotEndMin
        }
      }
      cur.setDate(cur.getDate() + 1)
    }

    if (slots.length > 0) {
      const { error } = await supabaseAdmin
        .from('queue_slots')
        .upsert(slots, { onConflict: 'technician_id,slot_date,slot_start', ignoreDuplicates: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { generated: slots.length } })
  }

  // ── Assign job to a slot ─────────────────────────────────────────────────
  if (body.action === 'assign') {
    const { slot_id, job_id } = body
    if (!slot_id || !job_id)
      return NextResponse.json({ error: 'slot_id and job_id required' }, { status: 400 })

    // Get slot info
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('queue_slots').select('*').eq('id', slot_id).single()
    if (slotErr || !slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    if (slot.status === 'booked') return NextResponse.json({ error: 'Slot already booked' }, { status: 409 })

    // Update slot
    await supabaseAdmin.from('queue_slots')
      .update({ job_id, status: 'booked' }).eq('id', slot_id)

    // Update job with technician + time
    await supabaseAdmin.from('jobs').update({
      technician_id: slot.technician_id,
      scheduled_date: slot.slot_date,
      scheduled_time: slot.slot_start,
      status: 'assigned',
    }).eq('id', job_id)

    return NextResponse.json({ data: { slot_id, job_id, date: slot.slot_date, time: slot.slot_start } })
  }

  // ── Block/unblock a slot ────────────────────────────────────────────────
  if (body.action === 'block' || body.action === 'unblock') {
    const { slot_id, note } = body
    const newStatus = body.action === 'block' ? 'blocked' : 'available'
    const { data, error } = await supabaseAdmin
      .from('queue_slots').update({ status: newStatus, note: note || null }).eq('id', slot_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// PATCH - update slot or working schedule
export async function PATCH(req: NextRequest) {
  const body = await req.json()

  if (body.schedule) {
    // Update technician working hours
    const { technician_id, ...schedData } = body.schedule
    const { data, error } = await supabaseAdmin
      .from('technician_schedules')
      .upsert({ technician_id, ...schedData }, { onConflict: 'technician_id' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  // Update single slot
  const { id, ...rest } = body
  const { data, error } = await supabaseAdmin
    .from('queue_slots').update(rest).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
