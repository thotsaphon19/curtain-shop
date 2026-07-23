import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyAccountingAndManagement, notifyEventGroups } from '@/lib/line'
export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('invoices').select('*, customer:customers(*)').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // If marking paid, set paid_amount = total
  if (body.status === 'paid') {
    const { data: inv } = await supabaseAdmin.from('invoices').select('total').eq('id', id).single()
    if (inv) body.paid_amount = inv.total
    if (!body.paid_at) body.paid_at = new Date().toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('invoices').update(body).eq('id', id)
    .select('*, customer:customers(name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.status === 'paid') {
    const custName = (data as unknown as { customer?: { name?: string } }).customer?.name || 'ลูกค้า'
    const paidText = `💰 รับชำระเงินแล้ว\n\nลูกค้า: ${custName}\nInvoice: ${data.invoice_no}\nยอด: ฿${(data.total || 0).toLocaleString()}\nยืนยันผ่าน: แอดมิน (ยืนยันด้วยตนเอง)`
    await notifyAccountingAndManagement(paidText)
    await notifyEventGroups('payment_confirmed', paidText)
  }

  return NextResponse.json({ data })
}
