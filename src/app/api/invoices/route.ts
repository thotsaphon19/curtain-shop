import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  let q = supabaseAdmin.from('invoices').select('*, customer:customers(name,phone,line_user_id)').order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const invoice_no = body.invoice_no || `INV${new Date().getFullYear()}${String(Date.now()).slice(-6)}`

  const subtotal = Number(body.subtotal ?? 0)
  const discount = Number(body.discount ?? 0)
  const vat_pct = Number(body.vat_pct ?? 0)
  const total = body.total !== undefined
    ? Number(body.total)
    : Math.max(0, subtotal - discount) * (1 + vat_pct / 100)

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .insert({
      ...body,
      invoice_no,
      subtotal,
      discount,
      vat_pct,
      total,
      invoice_type: body.invoice_type || 'installation',
      custom_fields: body.custom_fields || {},
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
