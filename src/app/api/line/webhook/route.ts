import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { isPaymentConfirmKeyword, sendGroupMessage } from '@/lib/line'
export const dynamic = 'force-dynamic'

function verifySignature(body: string, sig: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET || ''
  const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64')
  return hash === sig
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('x-line-signature') || ''
  if (!verifySignature(rawBody, sig))
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  const body = JSON.parse(rawBody)
  const events: LineEvent[] = body.events || []

  for (const event of events) {
    // ── Follow event: ลูกค้าหรือช่าง follow OA ──────────────────────────────
    if (event.type === 'follow') {
      const uid = event.source.userId
      console.log('[LINE] New follow:', uid)
      // Admin จะ map ทีหลังในหน้าตั้งค่า
    }

    // ── Join group event: OA ถูกเพิ่มเข้า group ──────────────────────────────
    if (event.type === 'join' && event.source.type === 'group') {
      const gid = event.source.groupId!
      console.log('[LINE] Joined group:', gid)
      // ส่งข้อความแนะนำตัว
      await sendGroupMessage(gid, [{
        type: 'text',
        text: '🪟 สวัสดีค่ะ ร้านผ้าม่านเชื่อมระบบแจ้งหนี้กับ LINE กลุ่มนี้แล้ว\n\nเมื่อสร้าง Invoice ระบบจะส่งยอดมาที่นี่อัตโนมัติ\nพิมพ์ "โอนแล้ว" หรือส่งสลิปเพื่อยืนยันการชำระค่ะ 💚',
      }])
    }

    // ── Message event: ตรวจหา keyword ชำระเงิน ──────────────────────────────
    if (event.type === 'message' && event.message.type === 'text') {
      const text: string = event.message.text || ''
      const userId: string = event.source.userId
      const groupId: string | undefined = event.source.groupId

      if (groupId) {
        await handleGroupMessage({ text, userId, groupId, event })
      } else {
        // DM — ช่างรับงานผ่าน command
        await handleDM({ text, userId })
      }
    }

    // ── Image message: ตรวจสลิปใน group ────────────────────────────────────
    if (event.type === 'message' && event.message.type === 'image') {
      const groupId: string | undefined = event.source.groupId
      const userId: string = event.source.userId
      if (groupId) {
        await handleSlipImage({ groupId, userId, messageId: event.message.id })
      }
    }
  }

  return NextResponse.json({ status: 'ok' })
}

// ── Handle group text message ─────────────────────────────────────────────────
async function handleGroupMessage(opts: {
  text: string; userId: string; groupId: string; event: LineEvent
}) {
  const { text, userId, groupId } = opts

  // โหลด keywords ที่ active
  const { data: kws } = await supabaseAdmin
    .from('payment_keywords').select('keyword').eq('active', true)
  const keywords = (kws || []).map(k => k.keyword)

  if (!isPaymentConfirmKeyword(text, keywords)) return

  // หา invoice ล่าสุดของ group นี้ที่ยังค้างชำระ
  const { data: gs } = await supabaseAdmin
    .from('line_group_settings').select('customer_id').eq('group_id', groupId).single()
  if (!gs) return

  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('customer_id', gs.customer_id)
    .in('status', ['unpaid', 'partial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!inv) return

  // Mark paid
  await supabaseAdmin.from('invoices').update({
    status: 'paid',
    paid_amount: inv.total,
    paid_at: new Date().toISOString(),
  }).eq('id', inv.id)

  // Log confirmation
  await supabaseAdmin.from('invoice_group_messages').update({
    confirmed_at: new Date().toISOString(),
    confirmed_by: userId,
  }).eq('invoice_id', inv.id).eq('group_id', groupId)

  // Log payment
  await supabaseAdmin.from('payment_logs').insert({
    invoice_id: inv.id,
    amount: inv.total - (inv.paid_amount || 0),
    method: 'line_confirm',
    note: `ยืนยันผ่าน LINE group: "${text}"`,
    confirmed_by: userId,
  })

  // ตอบกลับใน group
  await sendGroupMessage(groupId, [{
    type: 'text',
    text: `✅ รับทราบค่ะ!\n\nยืนยันการชำระ Invoice ${inv.invoice_no}\nยอด ฿${(inv.total || 0).toLocaleString()} บาท\nขอบคุณที่ใช้บริการนะคะ 🙏`,
  }])
}

// ── Handle slip image in group ────────────────────────────────────────────────
async function handleSlipImage(opts: { groupId: string; userId: string; messageId: string }) {
  const { groupId, userId, messageId } = opts

  // หา invoice ล่าสุดของ group
  const { data: gs } = await supabaseAdmin
    .from('line_group_settings').select('customer_id').eq('group_id', groupId).single()
  if (!gs) return

  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('customer_id', gs.customer_id)
    .in('status', ['unpaid', 'partial'])
    .order('created_at', { ascending: false })
    .limit(1).single()
  if (!inv) return

  // ดึงรูปสลิปจาก Line API
  const imageRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
  })

  let slipUrl: string | undefined
  if (imageRes.ok) {
    const buf = await imageRes.arrayBuffer()
    const b64 = Buffer.from(buf).toString('base64')
    // อัปโหลดขึ้น Supabase Storage
    const path = `slips/${inv.id}/${Date.now()}.jpg`
    const { data: uploaded } = await supabaseAdmin.storage
      .from('job-photos').upload(path, Buffer.from(buf), { contentType: 'image/jpeg', upsert: true })
    if (uploaded) {
      const { data: { publicUrl } } = supabaseAdmin.storage.from('job-photos').getPublicUrl(path)
      slipUrl = publicUrl
      void b64 // suppress unused warning
    }
  }

  // Mark paid
  await supabaseAdmin.from('invoices').update({
    status: 'paid',
    paid_amount: inv.total,
    paid_at: new Date().toISOString(),
    slip_url: slipUrl,
  }).eq('id', inv.id)

  await supabaseAdmin.from('payment_logs').insert({
    invoice_id: inv.id,
    amount: inv.total - (inv.paid_amount || 0),
    method: 'slip',
    slip_url: slipUrl,
    confirmed_by: userId,
  })

  await sendGroupMessage(groupId, [{
    type: 'text',
    text: `✅ ได้รับสลิปแล้วค่ะ!\n\nยืนยันการชำระ Invoice ${inv.invoice_no}\nยอด ฿${(inv.total || 0).toLocaleString()} บาท\nขอบคุณมากค่ะ 🙏`,
  }])
}

// ── Handle DM (ช่างรับ/ปิดงาน) ───────────────────────────────────────────────
async function handleDM(opts: { text: string; userId: string }) {
  const { text, userId } = opts
  const t = text.trim().toLowerCase()

  if (t.startsWith('รับงาน:') || t.startsWith('accept:')) {
    const jobId = text.replace(/^(รับงาน:|accept:)/i, '').trim()
    await supabaseAdmin.from('jobs').update({
      status: 'in_progress', accepted_at: new Date().toISOString(),
    }).eq('id', jobId).eq('technician_id',
      (await supabaseAdmin.from('technicians').select('id').eq('line_user_id', userId).single()).data?.id || ''
    )
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
interface LineSource { type: string; userId: string; groupId?: string }
interface LineMessage { type: string; text?: string; id: string }
interface LineEvent {
  type: string
  source: LineSource
  message: LineMessage
  replyToken?: string
}
