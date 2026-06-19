import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendInvoiceToGroup } from '@/lib/line'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { invoice_id } = await req.json()
  if (!invoice_id) return NextResponse.json({ error: 'invoice_id required' }, { status: 400 })

  // Get invoice with customer
  const { data: inv, error: invErr } = await supabaseAdmin
    .from('invoices')
    .select('*, customer:customers(id,name,phone)')
    .eq('id', invoice_id).single()
  if (invErr || !inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const customerId = (inv as unknown as {customer:{id:string}}).customer?.id
  if (!customerId) return NextResponse.json({ error: 'No customer on invoice' }, { status: 400 })

  // Get group setting
  const { data: gs } = await supabaseAdmin
    .from('line_group_settings')
    .select('*').eq('customer_id', customerId).single()
  if (!gs) return NextResponse.json({ error: 'No LINE group configured for this customer' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const cust = (inv as unknown as {customer:{name:string}}).customer

  const result = await sendInvoiceToGroup({
    groupId: gs.group_id,
    invoiceNo: inv.invoice_no,
    customerName: cust.name,
    amount: inv.total || 0,
    paidAmount: inv.paid_amount || 0,
    dueDate: inv.due_date,
    bankAccount: inv.bank_account,
    qrCodeUrl: inv.qr_code_url,
    invoiceUrl: `${appUrl}/invoices/${invoice_id}`,
  })

  if (!result.success) return NextResponse.json({ error: 'LINE send failed' }, { status: 500 })

  // Log
  await supabaseAdmin.from('invoice_group_messages').insert({
    invoice_id,
    group_id: gs.group_id,
    message_id: result.messageId,
  })

  return NextResponse.json({ success: true, message_id: result.messageId })
}
