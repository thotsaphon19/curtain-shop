import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyTechnicianAssigned } from '@/lib/line'
export const dynamic = 'force-dynamic'

// POST /api/jobs/assign
// Assign one or multiple jobs to a technician
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { job_ids, job_id, technician_id, scheduled_date, scheduled_time, notify = true } = body

  const ids: string[] = job_ids || (job_id ? [job_id] : [])
  if (!ids.length || !technician_id)
    return NextResponse.json({ error: 'job_ids and technician_id required' }, { status: 400 })

  // Get technician
  const { data: tech } = await supabaseAdmin.from('technicians').select('*').eq('id', technician_id).single()
  if (!tech) return NextResponse.json({ error: 'Technician not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const results: { job_id: string; success: boolean; notified: boolean; reason?: string }[] = []

  for (const id of ids) {
    const update: Record<string, unknown> = { technician_id, status: 'assigned' }
    if (scheduled_date) update.scheduled_date = scheduled_date
    if (scheduled_time) update.scheduled_time = scheduled_time

    const { data: job, error } = await supabaseAdmin
      .from('jobs')
      .update(update)
      .eq('id', id)
      .select('*, customer:customers(*)')
      .single()

    if (error) { results.push({ job_id: id, success: false, notified: false, reason: error.message }); continue }

    let notified = false
    let reason: string | undefined
    if (notify) {
      if (!tech.line_user_id) {
        reason = 'ช่างคนนี้ยังไม่ได้ผูกบัญชี LINE'
      } else if (job) {
        const cust = (job as unknown as { customer: { name: string; phone: string } }).customer
        const dateStr = new Date(job.scheduled_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
        const r = await notifyTechnicianAssigned({
          job_id: id, technician_line_id: tech.line_user_id,
          technician_name: tech.name, job_title: job.title,
          scheduled_date: dateStr, scheduled_date_iso: job.scheduled_date, scheduled_time: job.scheduled_time,
          address: job.address, customer_name: cust?.name || '',
          customer_phone: cust?.phone || '', app_url: appUrl,
        lat: job.lat || null,
        lng: job.lng || null,
        amount: job.amount, deposit_amount: job.deposit_amount, vat_amount: job.vat_amount,
        })
        notified = r.success
        reason = r.success ? undefined : r.error
      }
    }

    results.push({ job_id: id, success: true, notified, reason })
  }

  return NextResponse.json({ data: results, technician: { id: tech.id, name: tech.name } })
}
