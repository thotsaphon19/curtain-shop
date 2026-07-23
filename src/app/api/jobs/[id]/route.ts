import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { notifyOnTheWay, notifyJobCompleted, notifyTechnicianAssigned, notifyTechnicianJobUpdate, notifyJobInProgress, notifyAccountingAndManagement, notifyEventGroups, notifyJobEdited } from '@/lib/line'
import { createAndSendInstallationInvoiceForJob } from '@/lib/invoice'

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
  'amount', 'deposit_amount', 'vat_amount', 'invoice_no', 'bank_account',
] as const

const FIELD_LABELS: Record<string, string> = {
  title: 'ชื่องาน',
  description: 'รายละเอียด',
  address: 'ที่อยู่',
  scheduled_date: 'วันที่นัด',
  scheduled_time: 'เวลานัด',
  amount: 'ยอดทั้งหมด',
  deposit_amount: 'ยอดมัดจำ',
  vat_amount: 'VAT',
  invoice_no: 'เลขที่ Invoice',
  bank_account: 'เลขบัญชี',
}

// แปลงค่าฟิลด์ให้อ่านง่ายในข้อความแจ้งเตือน (วันที่เป็นไทย, เวลา HH:MM, ยอดมี ฿ คั่นหลักพัน)
function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (field === 'scheduled_date') {
    try {
      return new Date(value as string).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch { return String(value) }
  }
  if (field === 'scheduled_time') return String(value).slice(0, 5)
  if (field === 'amount') return `฿${Number(value).toLocaleString()}`
  return String(value)
}

// สร้างข้อความสรุปว่าแก้ไขอะไรบ้าง เช่น "• เวลานัด: 10:00 → 14:00"
function buildChangesText(changes: Record<string, { old: unknown; new: unknown; label: string }>): string {
  return Object.entries(changes)
    .map(([field, c]) => `• ${c.label}: ${formatFieldValue(field, c.old)} → ${formatFieldValue(field, c.new)}`)
    .join('\n')
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
  if (newStatus === 'heading') updates.accepted_at = new Date().toISOString()
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

    // ── แจ้งเตือนว่าแก้ไขอะไรบ้าง (ระบุรายละเอียดชัดเจน ไม่ใช่แค่ "มีการแก้ไข") ──
    const changesText = buildChangesText(changes)

    if (job.technician?.line_user_id) {
      await notifyJobEdited({
        job_id: job.id, recipient: 'technician', line_user_id: job.technician.line_user_id,
        job_title: job.title, changesText,
      })
    }

    // แจ้งลูกค้าด้วย เฉพาะตอนแก้ไขฟิลด์ที่กระทบลูกค้าโดยตรง (วันที่/เวลา/ที่อยู่)
    const customerFacingFields = ['scheduled_date', 'scheduled_time', 'address']
    const affectsCustomer = customerFacingFields.some(f => f in changes)
    if (affectsCustomer && job.customer?.line_user_id) {
      await notifyJobEdited({
        job_id: job.id, recipient: 'customer', line_user_id: job.customer.line_user_id,
        job_title: job.title, changesText,
      })
    }

    await notifyEventGroups(
      'job_edited',
      `✏️ แก้ไขข้อมูลงาน "${job.title}"\n\nลูกค้า: ${job.customer?.name || '-'}\nแก้ไขโดย: ${session?.display_name || 'ไม่ระบุ'}\n\n${changesText}`
    )
  }

  const dateStr = new Date(job.scheduled_date).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  // ── เก็บผลการแจ้งเตือน "ทุก" ครั้งไว้ส่งกลับให้หน้าเว็บ ─────────────────────
  // ก่อนหน้านี้ระบบเงียบเวลาแจ้งเตือนลูกค้า/ช่างไม่สำเร็จ (เช่น ยังไม่ได้ผูก LINE
  // กับ OA ปัจจุบัน) ทำให้ดูเหมือน "บันทึกแล้ว" สำเร็จทั้งที่อีกฝั่งไม่รู้เรื่องอะไรเลย
  const notifyResults: { recipient: 'customer' | 'technician'; type: string; attempted: boolean; success: boolean; reason?: string }[] = []

  // ── ช่างกดรับงาน → กำลังไปหน้างาน: แจ้งลูกค้า + แจ้งช่างเอง ────────────────
  if (newStatus === 'heading') {
    if (job.customer?.line_user_id) {
      const r = await notifyOnTheWay({
        job_id: job.id, customer_line_id: job.customer.line_user_id,
        customer_name: job.customer.name, technician_name: job.technician?.name || '',
        technician_phone: job.technician?.phone || '',
      })
      notifyResults.push({ recipient: 'customer', type: 'on_the_way', attempted: true, success: r.success, reason: r.success ? undefined : r.error })
    } else {
      notifyResults.push({ recipient: 'customer', type: 'on_the_way', attempted: false, success: false, reason: 'ลูกค้ายังไม่ได้ผูกบัญชี LINE' })
    }
    if (job.technician?.line_user_id) {
      await notifyTechnicianJobUpdate({
        job_id: job.id, technician_line_id: job.technician.line_user_id,
        job_title: job.title, stage: 'heading',
      })
    }
  }

  // ── ช่างถ่ายรูปหน้างานก่อนเริ่ม + กดบันทึก → กำลังดำเนินงาน: แจ้งลูกค้า + ช่าง + บัญชี/ผู้บริหาร ──
  if (newStatus === 'in_progress') {
    if (job.customer?.line_user_id) {
      const r = await notifyJobInProgress({
        job_id: job.id, customer_line_id: job.customer.line_user_id,
        customer_name: job.customer.name, technician_name: job.technician?.name || '',
      })
      notifyResults.push({ recipient: 'customer', type: 'job_in_progress', attempted: true, success: r.success, reason: r.success ? undefined : r.error })
    } else {
      notifyResults.push({ recipient: 'customer', type: 'job_in_progress', attempted: false, success: false, reason: 'ลูกค้ายังไม่ได้ผูกบัญชี LINE' })
    }
    if (job.technician?.line_user_id) {
      await notifyTechnicianJobUpdate({
        job_id: job.id, technician_line_id: job.technician.line_user_id,
        job_title: job.title, stage: 'in_progress',
      })
    }
    await notifyAccountingAndManagement(
      `🔧 งานเริ่มดำเนินการแล้ว\n\nงาน: ${job.title}\nลูกค้า: ${job.customer?.name || '-'}\nช่าง: ${job.technician?.name || '-'}\nที่อยู่: ${job.address}`
    )
  }

  if (newStatus === 'completed') {
    if (job.customer?.line_user_id) {
      const r = await notifyJobCompleted({
        job_id: job.id, customer_line_id: job.customer.line_user_id,
        customer_name: job.customer.name, technician_name: job.technician?.name || '',
        end_photo_url: job.end_photo_url, amount: job.amount,
        bank_account: job.bank_account, qr_code_url: job.qr_code_url,
      })
      notifyResults.push({ recipient: 'customer', type: 'job_completed', attempted: true, success: r.success, reason: r.success ? undefined : r.error })
    } else {
      notifyResults.push({ recipient: 'customer', type: 'job_completed', attempted: false, success: false, reason: 'ลูกค้ายังไม่ได้ผูกบัญชี LINE' })
    }
    await notifyEventGroups(
      'job_completed',
      `✅ งานเสร็จสมบูรณ์\n\nงาน: ${job.title}\nลูกค้า: ${job.customer?.name || '-'}\nช่าง: ${job.technician?.name || '-'}\nที่อยู่: ${job.address}`
    )
    // สร้าง Invoice งานติดตั้ง (ไม่มีรายการสินค้า) และส่งให้ลูกค้าทาง LINE ทันที
    // พร้อมเข้ากลุ่มที่ผูกกับขุนทอง (ถ้าตั้งค่า auto_send ไว้)
    await createAndSendInstallationInvoiceForJob({
      id: job.id, title: job.title, amount: job.amount,
      deposit_amount: job.deposit_amount, vat_amount: job.vat_amount,
      has_invoice_no: job.has_invoice_no, invoice_no: job.invoice_no,
      bank_account: job.bank_account, qr_code_url: job.qr_code_url,
      customer_id: job.customer_id, customer: job.customer,
    })
  }

  // ── มอบหมาย/เปลี่ยนช่าง → แจ้งเตือนช่างคนใหม่ ─────────────────────────────
  let technicianNotify: { attempted: boolean; success: boolean; reason?: string } = { attempted: false, success: false }
  if (body.technician_id && body.technician_id !== current.technician_id) {
    if (!job.technician?.line_user_id) {
      technicianNotify = { attempted: false, success: false, reason: 'ช่างคนนี้ยังไม่ได้ผูกบัญชี LINE — ไปผูกที่หน้า Settings ก่อน' }
    } else {
      const r = await notifyTechnicianAssigned({
        job_id: job.id, technician_line_id: job.technician.line_user_id,
        technician_name: job.technician.name, job_title: job.title,
        scheduled_date: dateStr, scheduled_date_iso: job.scheduled_date, scheduled_time: job.scheduled_time,
        address: job.address, customer_name: job.customer?.name || '',
        customer_phone: job.customer?.phone || '', app_url: appUrl,
        lat: job.lat || null,
        lng: job.lng || null,
        amount: job.amount, deposit_amount: job.deposit_amount, vat_amount: job.vat_amount,
      })
      technicianNotify = { attempted: true, success: r.success, reason: r.success ? undefined : r.error }
    }
    notifyResults.push({ recipient: 'technician', type: 'technician_assigned', ...technicianNotify })
  }

  return NextResponse.json({
    data: job, changed_fields: Object.keys(changes),
    technician_notify: technicianNotify, // เก็บไว้เพื่อไม่ให้โค้ดฝั่งหน้าเว็บเดิมพัง
    notify_results: notifyResults,
  })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await supabaseAdmin.from('jobs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deleted' })
}

export const dynamic = 'force-dynamic'
