import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { pushMessage } from '@/lib/line'
export const dynamic = 'force-dynamic'

// ══════════════════════════════════════════════════════════════════════════
// "ย้ายไป OA ใหม่" — คำเตือนสำคัญ: LINE ไม่มี API ให้โอนสถานะ "เป็นเพื่อนกัน"
// จาก OA บัญชีหนึ่งไปอีกบัญชีหนึ่งได้ ไม่ว่าจะทางไหนก็ตาม ต้องให้แต่ละคนกดแอดเพื่อน
// OA ใหม่ด้วยตัวเองเท่านั้น
//
// สิ่งที่ทำได้จริงคือ "ส่งคำเชิญให้ทุกคนพร้อมกันทีเดียว" ผ่าน OA เดิม (ที่ยังเป็น
// เพื่อนกับลูกค้า/ช่างอยู่) แนบลิงก์แอดเพื่อน OA ใหม่ไปให้ — ระบบไม่สามารถผูก
// line_user_id ใหม่ให้อัตโนมัติได้ ต้องรอให้แต่ละคนแอดเพื่อนแล้วทักเข้ามา
// จากนั้นแอดมินค่อยไปผูกที่หน้า "คนที่เคยทัก LINE OA" อีกที
// ══════════════════════════════════════════════════════════════════════════

// GET — preview จำนวนคนที่จะได้รับคำเชิญ ก่อนกดส่งจริง
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fromOaAccountId = searchParams.get('from_oa_account_id')

  const { data: oaAccounts } = await supabaseAdmin
    .from('line_oa_accounts').select('id, name, is_default, active').order('is_default', { ascending: false })

  let custQuery = supabaseAdmin.from('customers').select('id', { count: 'exact', head: true }).not('line_user_id', 'is', null)
  let techQuery = supabaseAdmin.from('technicians').select('id', { count: 'exact', head: true }).not('line_user_id', 'is', null).eq('status', 'active')

  if (fromOaAccountId) {
    custQuery = custQuery.or(`oa_account_id.eq.${fromOaAccountId},oa_account_id.is.null`)
    techQuery = techQuery.or(`oa_account_id.eq.${fromOaAccountId},oa_account_id.is.null`)
  }

  const [{ count: customerCount }, { count: technicianCount }] = await Promise.all([custQuery, techQuery])

  return NextResponse.json({
    oa_accounts: oaAccounts || [],
    preview: { customers: customerCount || 0, technicians: technicianCount || 0 },
  })
}

// POST — ส่งคำเชิญจริง
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { from_oa_account_id, new_oa_url, message, include_customers = true, include_technicians = true } = await req.json()

  if (!from_oa_account_id) return NextResponse.json({ error: 'ต้องเลือก OA บัญชีเดิมที่จะใช้ส่ง' }, { status: 400 })
  if (!new_oa_url || !/^https?:\/\//.test(new_oa_url))
    return NextResponse.json({ error: 'ต้องระบุลิงก์แอดเพื่อน OA ใหม่ (ขึ้นต้นด้วย https://)' }, { status: 400 })
  if (!include_customers && !include_technicians)
    return NextResponse.json({ error: 'ต้องเลือกส่งให้อย่างน้อยกลุ่มลูกค้าหรือช่าง' }, { status: 400 })

  const text = `${(message || '').trim() || defaultMessage()}\n\n👉 ${new_oa_url}`

  const recipients: { id: string; line_user_id: string; kind: 'customer' | 'technician' }[] = []

  if (include_customers) {
    const { data: customers } = await supabaseAdmin
      .from('customers').select('id, line_user_id, oa_account_id')
      .not('line_user_id', 'is', null)
      .or(`oa_account_id.eq.${from_oa_account_id},oa_account_id.is.null`)
    for (const c of customers || []) recipients.push({ id: c.id, line_user_id: c.line_user_id as string, kind: 'customer' })
  }

  if (include_technicians) {
    const { data: technicians } = await supabaseAdmin
      .from('technicians').select('id, line_user_id, oa_account_id')
      .not('line_user_id', 'is', null).eq('status', 'active')
      .or(`oa_account_id.eq.${from_oa_account_id},oa_account_id.is.null`)
    for (const t of technicians || []) recipients.push({ id: t.id, line_user_id: t.line_user_id as string, kind: 'technician' })
  }

  // ส่งเป็นชุด (concurrency จำกัด) กัน rate limit ของ LINE ตอนมีลูกค้า/ช่างเยอะ
  const BATCH_SIZE = 8
  let sent = 0, failed = 0
  const failedItems: { id: string; kind: string; error?: string }[] = []

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(r => pushMessage(r.line_user_id, [{ type: 'text', text }], from_oa_account_id))
    )
    results.forEach((r, idx) => {
      if (r.success) sent++
      else { failed++; failedItems.push({ id: batch[idx].id, kind: batch[idx].kind, error: r.error }) }
    })
  }

  // เก็บ log ไว้ตรวจสอบย้อนหลังได้ (ผ่านตาราง notification_logs เดิม ใช้ recipient='admin' + type เฉพาะ)
  await supabaseAdmin.from('notification_logs').insert({
    recipient: 'admin',
    type: 'oa_migration_invite',
    message: `ส่งคำเชิญย้าย OA ให้ ${recipients.length} คน (สำเร็จ ${sent} / ไม่สำเร็จ ${failed})`,
    success: failed === 0,
    error_msg: failed > 0 ? JSON.stringify(failedItems).slice(0, 2000) : null,
  })

  return NextResponse.json({
    total: recipients.length, sent, failed, failed_items: failedItems,
  })
}

function defaultMessage() {
  return '📢 ประกาศเปลี่ยนช่องทาง LINE ใหม่\n\nร้านได้เปลี่ยนบัญชี LINE อย่างเป็นทางการค่ะ กรุณาแอดเพื่อนช่องทางใหม่ด้านล่างนี้ เพื่อให้ยังคงได้รับแจ้งเตือนงาน/นัดหมายต่อเนื่องนะคะ 🙏\n\n(ช่องทางเดิมนี้จะปิดการแจ้งเตือนในเร็วๆ นี้)'
}
