import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyOnTheWay, notifyJobCompleted, notifyTechnicianAssigned } from '@/lib/line'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('*, customer:customers(*), technician:technicians(*), notification_logs(*)')
    .eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('jobs').select('*, customer:customers(*), technician:technicians(*)').eq('id', id).single()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 404 })

  const updates: Record<string, unknown> = { ...body }
  const newStatus = body.status
  if (newStatus === 'in_progress') updates.accepted_at = new Date().toISOString()
  if (newStatus === 'completed') updates.completed_at = new Date().toISOString()
  if (body.technician_id && body.technician_id !== current.technician_id) updates.status = 'assigned'

  const { data: job, error } = await supabaseAdmin
    .from('jobs').update(updates).eq('id', id)
    .select('*, customer:customers(*), technician:technicians(*)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const dateStr = new Date(job.scheduled_date).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  if (newStatus === 'in_progress' && job.customer?.line_user_id) {
    await notifyOnTheWay({
      job_id: job.id, customer_line_id: job.customer.line_user_id,
      customer_name: job.customer.name, technician_name: job.technician?.name || '',
      technician_phone: job.technician?.phone || '',
    })
  }

  if (newStatus === 'completed' && job.customer?.line_user_id) {
    await notifyJobCompleted({
      job_id: job.id, customer_line_id: job.customer.line_user_id,
      customer_name: job.customer.name, technician_name: job.technician?.name || '',
      end_photo_url: job.end_photo_url, amount: job.amount,
      bank_account: job.bank_account, qr_code_url: job.qr_code_url,
    })
  }

  if (body.technician_id && body.technician_id !== current.technician_id && job.technician?.line_user_id) {
    await notifyTechnicianAssigned({
      job_id: job.id, technician_line_id: job.technician.line_user_id,
      technician_name: job.technician.name, job_title: job.title,
      scheduled_date: dateStr, scheduled_time: job.scheduled_time,
      address: job.address, customer_name: job.customer?.name || '',
      customer_phone: job.customer?.phone || '', app_url: appUrl,
    })
  }

  return NextResponse.json({ data: job })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('jobs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deleted' })
}

export const dynamic = 'force-dynamic'
