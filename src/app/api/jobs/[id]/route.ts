import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { notifyOnTheWay, notifyJobCompleted, notifyTechnicianAssigned } from '@/lib/line'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('*, customer:customers(*), technician:technicians(*), notification_logs(*)')
    .eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: editLogs } = await supabaseAdmin
    .from('job_edit_logs').select('*').eq('job_id', id).order('created_at', { ascending: false })

  return NextResponse.json({ data: { ...data, edit_logs: editLogs || [] } })
}

// ฟิลด์ที่อนุญาตให้แก้ไขผ่านฟอร์ม "แก้ไขข้อมูลงาน" — แยกจาก status/technician_id
// ที่มีปุ่ม action เฉพาะของตัวเองอยู่แล้ว เพื่อไม่ให้ปนกัน
const EDITABLE_FIELDS = [
  'title', 'description', 'address', 'scheduled_date', 'scheduled_time',
  'amount', 'bank_account',
] as const

const FIELD_LABELS: Record<string, string> = {
  title: 'ชื่องาน',
  description: 'รายละเอียด',
  address: 'ที่อยู่',
  scheduled_date: 'วันที่นัด',
  scheduled_time: 'เวลานัด',
  amount: 'ยอดเรียกเก็บ',
  bank_account: 'เลขบัญชี',
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const session = await getSession()

  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('jobs').select('*, customer:customers(*), technician:technicians(*)').eq('id', id).single()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 404 })

  // ── สร้าง diff สำหรับฟิลด์ที่แก้ไขได้ (ก่อนจะ update จริง) ────────────────
  const changes: Record<string, { old: unknown; new: unknown; label: string }> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body && body[field] !== current[field]) {
      changes[field] = { old: current[field], new: body[field], label: FIELD_LABELS[field] }
    }
  }

  const updates: Record<string, unknown> = { ...body }
  const newStatus = body.status
  if (newStatus === 'in_progress') updates.accepted_at = new Date().toISOString()
  if (newStatus === 'completed') updates.completed_at = new Date().toISOString()
  if (body.technician_id && body.technician_id !== current.technician_id) updates.status = 'assigned'

  const { data: job, error } = await supabaseAdmin
    .from('jobs').update(updates).eq('id', id)
    .select('*, customer:customers(*), technician:technicians(*)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── บันทึก log การแก้ไขข้อมูลงาน (เฉพาะตอนมีการเปลี่ยนค่าจริง) ──────────────
  if (Object.keys(changes).length > 0) {
    await supabaseAdmin.from('job_edit_logs').insert({
      job_id: id,
      edited_by_name: session?.display_name || 'ไม่ระบุ',
      changes,
      note: body.edit_note || null,
    })
  }

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

  return NextResponse.json({ data: job, changed_fields: Object.keys(changes) })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('jobs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deleted' })
}

export const dynamic = 'force-dynamic'
