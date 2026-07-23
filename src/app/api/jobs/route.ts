import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyBookingConfirm, notifyTechnicianAssigned, notifyEventGroups } from '@/lib/line'

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
    amount, deposit_amount, vat_amount, has_invoice_no, invoice_no, bank_account,
  } = body

  if (!customer_id || !title || !address || !scheduled_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const timeValue = scheduled_time || null // '' -> NULL (คอลัมน์ TIME ไม่รับ empty string)

  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .insert({
      customer_id, technician_id, title, description,
      address, lat, lng, scheduled_date, scheduled_time: timeValue,
      amount, deposit_amount: deposit_amount || 0, vat_amount: vat_amount ?? null,
      has_invoice_no: !!has_invoice_no, invoice_no: has_invoice_no ? (invoice_no || null) : null,
      bank_account,
      status: technician_id ? 'assigned' : 'pending',
    })
    .select(`*, customer:customers(*), technician:technicians(*)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const dateStr = new Date(scheduled_date).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const notifyResults: { recipient: 'customer' | 'technician'; attempted: boolean; success: boolean; reason?: string }[] = []

  // Notify customer
  if (job.customer?.line_user_id) {
    const r = await notifyBookingConfirm({
      job_id: job.id,
      customer_line_id: job.customer.line_user_id,
      customer_name: job.customer.name,
      job_title: job.title,
      scheduled_date: dateStr,
      scheduled_time: timeValue,
      address: job.address,
      app_url: appUrl,
    })
    notifyResults.push({ recipient: 'customer', attempted: true, success: r.success, reason: r.success ? undefined : r.error })
  } else {
    notifyResults.push({ recipient: 'customer', attempted: false, success: false, reason: 'ลูกค้ายังไม่ได้ผูกบัญชี LINE' })
  }

  // Notify technician if assigned
  if (technician_id) {
    if (job.technician?.line_user_id) {
      const r = await notifyTechnicianAssigned({
        job_id: job.id,
        technician_line_id: job.technician.line_user_id,
        technician_name: job.technician.name,
        job_title: job.title,
        scheduled_date: dateStr,
        scheduled_date_iso: job.scheduled_date,
        scheduled_time: timeValue,
        address: job.address,
        customer_name: job.customer?.name || '',
        customer_phone: job.customer?.phone || '',
        app_url: appUrl,
        lat: job.lat || null,
        lng: job.lng || null,
        amount: job.amount, deposit_amount: job.deposit_amount, vat_amount: job.vat_amount,
      })
      notifyResults.push({ recipient: 'technician', attempted: true, success: r.success, reason: r.success ? undefined : r.error })
    } else {
      notifyResults.push({ recipient: 'technician', attempted: false, success: false, reason: 'ช่างคนนี้ยังไม่ได้ผูกบัญชี LINE' })
    }
  }

  await notifyEventGroups(
    'new_job',
    `🆕 มีงานใหม่เข้ามา\n\nงาน: ${job.title}\nลูกค้า: ${job.customer?.name || '-'}\nวันที่นัด: ${dateStr}\nที่อยู่: ${job.address}`
  )

  return NextResponse.json({ data: job, notify_results: notifyResults }, { status: 201 })
}
export const dynamic = 'force-dynamic'
