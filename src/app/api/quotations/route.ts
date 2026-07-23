import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('quotations').select('*, customer:customers(name,phone), quotation_items(*)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { items = [], customer_id, job_id, discount = 0, vat_pct = 7, valid_until, notes } = body

  if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  const subtotal = (items as { qty: number; unit_price: number }[])
    .reduce((s, i) => s + (Number(i.qty) * Number(i.unit_price)), 0)
  const afterDiscount = subtotal - Number(discount)
  const total = afterDiscount + (afterDiscount * Number(vat_pct) / 100)

  // สร้างเลขที่ใบเสนอราคา
  const year = new Date().getFullYear()
  const { count } = await supabaseAdmin.from('quotations').select('*', { count: 'exact', head: true })
  const quotation_no = `QT${year}-${String((count || 0) + 1).padStart(4, '0')}`

  const { data: qt, error } = await supabaseAdmin
    .from('quotations').insert({
      customer_id, job_id: job_id || null, quotation_no,
      status: 'draft', subtotal, discount, vat_pct, total,
      valid_until: valid_until || null, notes: notes || null,
    }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (items.length > 0) {
    await supabaseAdmin.from('quotation_items')
      .insert(items.map((i: Record<string, unknown>) => ({ ...i, quotation_id: qt.id })))
  }

  return NextResponse.json({ data: qt }, { status: 201 })
}
