import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendGroupMessage, sendInvoiceToGroup } from '@/lib/line'
export const dynamic = 'force-dynamic'

// POST /api/line/notify-individual
// body: { customer_id, invoice_id?, channel: 'dm'|'group'|'khunthong'|'all', custom_message? }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { customer_id, invoice_id, channel = 'all', custom_message } = body

  if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  // โหลด customer
  const { data: customer } = await supabaseAdmin
    .from('customers').select('*').eq('id', customer_id).single()
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  // โหลด LINE group setting
  const { data: gs } = await supabaseAdmin
    .from('line_group_settings').select('*').eq('customer_id', customer_id).single()

  // โหลด invoice (ถ้าระบุ หรือเลือกล่าสุด)
  let invoice: Record<string, unknown> | null = null
  if (invoice_id) {
    const { data } = await supabaseAdmin.from('invoices').select('*').eq('id', invoice_id).single()
    invoice = data
  } else {
    const { data } = await supabaseAdmin
      .from('invoices').select('*')
      .eq('customer_id', customer_id)
      .in('status', ['unpaid', 'partial', 'overdue'])
      .order('created_at', { ascending: false }).limit(1).single()
    invoice = data
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const results: { channel: string; success: boolean; error?: string }[] = []

  // ── 1. LINE DM (push ตรง) ────────────────────────────────────────────────
  if ((channel === 'dm' || channel === 'all') && customer.line_user_id) {
    const text = custom_message || buildDMMessage(customer, invoice)
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
      body: JSON.stringify({ to: customer.line_user_id, messages: [{ type: 'text', text }] }),
    })
    results.push({ channel: 'dm', success: res.ok, error: res.ok ? undefined : await res.text() })
    await logNotification({ customer_id, invoice_id: invoice?.id as string, channel: 'dm', message: text, success: res.ok })
  }

  // ── 2. LINE Group ────────────────────────────────────────────────────────
  if ((channel === 'group' || channel === 'all') && gs?.group_id) {
    if (invoice) {
      const r = await sendInvoiceToGroup({
        groupId: gs.group_id,
        invoiceNo: invoice.invoice_no as string,
        customerName: customer.name,
        amount: invoice.total as number || 0,
        paidAmount: invoice.paid_amount as number || 0,
        dueDate: invoice.due_date as string,
        bankAccount: invoice.bank_account as string,
        qrCodeUrl: invoice.qr_code_url as string,
        invoiceUrl: `${appUrl}/invoices/${invoice.id}`,
      })
      results.push({ channel: 'group', success: r.success })
      await logNotification({ customer_id, invoice_id: invoice.id as string, channel: 'group', message: `Invoice ${invoice.invoice_no}`, success: r.success })
    } else if (custom_message) {
      const r = await sendGroupMessage(gs.group_id, [{ type: 'text', text: custom_message }])
      results.push({ channel: 'group', success: r.success })
    }
  }

  // ── 3. ขุนทอง — ส่งคำสั่งใน group เพื่อให้ขุนทองทวง ─────────────────────
  if ((channel === 'khunthong' || channel === 'all') && gs?.group_id && gs.khunthong_added && invoice) {
    const remain = (invoice.total as number || 0) - (invoice.paid_amount as number || 0)
    // ส่งข้อความสรุปยอดพร้อมแท็ก เพื่อให้ขุนทองรับรู้
    const khunthongMsg =
      `@ขุนทอง ช่วยทวงเงินค่าผ้าม่านให้หน่อยนะคะ\n\n` +
      `💰 ยอดค้าง: ฿${remain.toLocaleString()} บาท\n` +
      `📄 Invoice: ${invoice.invoice_no}\n` +
      `👤 ลูกค้า: คุณ${customer.name}\n\n` +
      `โอนมาที่: ${invoice.bank_account || '(ดูในการ์ดด้านบน)'}\n` +
      `ขอบคุณค่ะ 🙏`
    const r = await sendGroupMessage(gs.group_id, [{ type: 'text', text: khunthongMsg }])
    results.push({ channel: 'khunthong', success: r.success })
    await logNotification({ customer_id, invoice_id: invoice.id as string, channel: 'khunthong', message: khunthongMsg, success: r.success })
  }

  const anySuccess = results.some(r => r.success)
  return NextResponse.json({
    success: anySuccess,
    results,
    customer_name: customer.name,
    channels_used: results.map(r => r.channel),
  })
}

// ── GET — ดึงประวัติการแจ้งเตือนของ customer ──────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const customer_id = searchParams.get('customer_id')
  if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('notification_logs')
    .select('*')
    .eq('job_id', customer_id)   // repurpose job_id field as ref_id
    .order('sent_at', { ascending: false })
    .limit(50)
  return NextResponse.json({ data: data || [] })
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildDMMessage(customer: Record<string, unknown>, invoice: Record<string, unknown> | null): string {
  if (!invoice) {
    return (
      `สวัสดีค่ะ คุณ${customer.name}\n` +
      `ทีมงานร้านผ้าม่านส่งสาร\n` +
      `หากมีข้อสงสัยเรื่องงาน ติดต่อได้เลยนะคะ 🪟`
    )
  }
  const remain = (invoice.total as number || 0) - (invoice.paid_amount as number || 0)
  const dueStr = invoice.due_date
    ? new Date(invoice.due_date as string).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'ไม่กำหนด'
  return (
    `💳 แจ้งเตือนการชำระเงิน\n\n` +
    `เรียน คุณ${customer.name} ค่ะ\n\n` +
    `📄 Invoice: ${invoice.invoice_no}\n` +
    `💰 ยอดค้างชำระ: ฿${remain.toLocaleString()} บาท\n` +
    `📅 ครบกำหนด: ${dueStr}\n` +
    (invoice.bank_account ? `🏦 โอน: ${invoice.bank_account}\n` : '') +
    `\nกรุณาโอนเงินและพิมพ์ "โอนแล้ว" หรือส่งสลิปยืนยันด้วยนะคะ\nขอบคุณที่ใช้บริการค่ะ 🙏`
  )
}

async function logNotification(opts: {
  customer_id: string; invoice_id?: string; channel: string; message: string; success: boolean
}) {
  await supabaseAdmin.from('notification_logs').insert({
    job_id: opts.customer_id,        // reuse as ref_id
    recipient: 'customer',
    type: `individual_${opts.channel}`,
    message: opts.message,
    success: opts.success,
  })
}
