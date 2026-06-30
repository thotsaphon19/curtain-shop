import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyBookingConfirm, notifyTechnicianAssigned } from '@/lib/line'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const status = searchParams.get('status')
  const technician_id = searchParams.get('technician_id')

  let query = supabaseAdmin
    .from('jobs')
    .select(`*, customer:customers(*), technician:technicians(*)`)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })

  if (date) query = query.eq('scheduled_date', date)
  if (status) query = query.eq('status', status)
  if (technician_id) query = query.eq('technician_id', technician_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    customer_id, technician_id, title, description,
    address, lat, lng, scheduled_date, scheduled_time,
    amount, bank_account,
  } = body

  if (!customer_id || !title || !address || !scheduled_date || !scheduled_time) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .insert({
      customer_id, technician_id, title, description,
      address, lat, lng, scheduled_date, scheduled_time,
      amount, bank_account,
      status: technician_id ? 'assigned' : 'pending',
    })
    .select(`*, customer:customers(*), technician:technicians(*)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const dateStr = new Date(scheduled_date).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  // Notify customer
  if (job.customer?.line_user_id) {
    await notifyBookingConfirm({
      job_id: job.id,
      customer_line_id: job.customer.line_user_id,
      customer_name: job.customer.name,
      job_title: job.title,
      scheduled_date: dateStr,
      scheduled_time: scheduled_time,
      address: job.address,
      app_url: appUrl,
    })
  }

  // Notify technician if assigned
  if (job.technician?.line_user_id) {
    await notifyTechnicianAssigned({
      job_id: job.id,
      technician_line_id: job.technician.line_user_id,
      technician_name: job.technician.name,
      job_title: job.title,
      scheduled_date: dateStr,
      scheduled_time: scheduled_time,
      address: job.address,
      customer_name: job.customer?.name || '',
      customer_phone: job.customer?.phone || '',
      app_url: appUrl,
    })
  }

  return NextResponse.json({ data: job }, { status: 201 })
}
export const dynamic = 'force-dynamic'
