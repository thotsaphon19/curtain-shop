import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('quotations')
    .select('*, customer:customers(id,name,phone,address), job:jobs(id,title), quotation_items(*)')
    .eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { items, ...updates } = body

  // คำนวณ subtotal จาก items ถ้ามีส่ง
  if (items !== undefined) {
    const subtotal = (items as { qty: number; unit_price: number }[])
      .reduce((s, i) => s + (Number(i.qty) * Number(i.unit_price)), 0)
    const discount = Number(updates.discount || 0)
    const vatPct = Number(updates.vat_pct ?? 7)
    const afterDiscount = subtotal - discount
    updates.subtotal = subtotal
    updates.total = afterDiscount + (afterDiscount * vatPct / 100)

    // ลบ items เก่า แล้ว insert ใหม่
    await supabaseAdmin.from('quotation_items').delete().eq('quotation_id', id)
    if (items.length > 0) {
      await supabaseAdmin.from('quotation_items')
        .insert(items.map((i: Record<string, unknown>) => ({ ...i, quotation_id: id })))
    }
  }

  const { data, error } = await supabaseAdmin
    .from('quotations').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('quotations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deleted' })
}
