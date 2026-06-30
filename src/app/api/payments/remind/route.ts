import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Support either direct params or invoice_id lookup
  let customerId: string | undefined
  let invoiceNo: string = body.invoice_no
  let amount: number = body.amount
  let customerName: string = body.customer_name
  let customerLineId: string = body.customer_line_id

  if (body.invoice_id && !customerLineId) {
    const { data: inv } = await supabaseAdmin
      .from('invoices').select('*, customer:customers(name,line_user_id,id)')
      .eq('id', body.invoice_id).single()
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const cust = (inv as unknown as {customer:{name:string,line_user_id?:string,id:string}}).customer
    invoiceNo = inv.invoice_no
    amount = (inv.total || 0) - (inv.paid_amount || 0)
    customerName = cust?.name || ''
    customerLineId = cust?.line_user_id || ''
    customerId = cust?.id
  }

  if (!customerLineId) {
    // Try LINE group fallback
    if (customerId) {
      const { data: gs } = await supabaseAdmin
        .from('line_group_settings').select('group_id').eq('customer_id', customerId).single()
      if (gs?.group_id) {
        const text =
          `💳 แจ้งเตือนการชำระเงิน\n\n` +
          `เรียน คุณ${customerName}\n` +
          `Invoice: ${invoiceNo}\n` +
          `ยอดค้างชำระ: ${Number(amount).toLocaleString()} บาท\n\n` +
          `กรุณาโอนเงินตามรายละเอียดที่ได้รับก่อนหน้าค่ะ\n` +
          `หากมีข้อสงสัยติดต่อร้านค้าได้เลยนะคะ 🙏`
        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
          body: JSON.stringify({ to: gs.group_id, messages: [{ type: 'text', text }] }),
        })
        return NextResponse.json({ success: true, channel: 'group' })
      }
    }
    return NextResponse.json({ error: 'No LINE ID or group for this customer' }, { status: 400 })
  }

  const text =
    `💳 แจ้งเตือนการชำระเงิน\n\n` +
    `เรียน คุณ${customerName}\n` +
    `Invoice: ${invoiceNo}\n` +
    `ยอดค้างชำระ: ${Number(amount).toLocaleString()} บาท\n\n` +
    `กรุณาโอนเงินตามรายละเอียดที่ได้รับก่อนหน้าค่ะ\n` +
    `หากมีข้อสงสัยติดต่อร้านค้าได้เลยนะคะ 🙏`

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ to: customerLineId, messages: [{ type: 'text', text }] }),
  })

  if (!res.ok) return NextResponse.json({ error: 'LINE push failed' }, { status: 500 })
  return NextResponse.json({ success: true, channel: 'dm' })
}
