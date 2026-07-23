import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildInvoiceText, notifyInvoiceToCustomer } from '@/lib/line'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { invoice_id } = await req.json()
  if (!invoice_id) return NextResponse.json({ error: 'invoice_id required' }, { status: 400 })

  const { data: inv, error: invErr } = await supabaseAdmin
    .from('invoices')
    .select('*, customer:customers(id,name,line_user_id), job:jobs(id,title)')
    .eq('id', invoice_id).single()
  if (invErr || !inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const cust = (inv as unknown as { customer: { id: string; name: string; line_user_id?: string } }).customer
  const job = (inv as unknown as { job?: { id?: string; title?: string } }).job
  if (!cust?.line_user_id) {
    return NextResponse.json({ error: 'ลูกค้ายังไม่ได้เชื่อม LINE (ไม่มี line_user_id)' }, { status: 400 })
  }

  const { data: templates } = await supabaseAdmin
    .from('invoice_field_templates').select('field_key,label').eq('active', true)
  const fieldLabels = Object.fromEntries((templates || []).map(t => [t.field_key, t.label]))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const text = buildInvoiceText({
    invoiceNo: inv.invoice_no,
    customerName: cust.name,
    jobTitle: job?.title,
    amount: inv.total || 0,
    paidAmount: inv.paid_amount || 0,
    dueDate: inv.due_date,
    bankAccount: inv.bank_account,
    qrCodeUrl: inv.qr_code_url,
    customFields: (inv.custom_fields as Record<string, string>) || {},
    fieldLabels,
    invoiceUrl: appUrl ? `${appUrl}/invoices/${invoice_id}` : undefined,
  })

  const result = await notifyInvoiceToCustomer({
    job_id: job?.id,
    invoice_id,
    customer_line_id: cust.line_user_id,
    text,
  })
  if (!result.success) return NextResponse.json({ error: result.error || 'LINE send failed' }, { status: 500 })

  await supabaseAdmin.from('invoices').update({
    sent_at: new Date().toISOString(),
    sent_channel: 'line_dm',
  }).eq('id', invoice_id)

  return NextResponse.json({ success: true })
}
