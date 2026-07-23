import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

// GET — รายการฟิลด์ทั้งหมด (default: เฉพาะที่ active) เรียงตาม sort_order
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === '1'
  let q = supabaseAdmin.from('invoice_field_templates').select('*').order('sort_order', { ascending: true })
  if (!all) q = q.eq('active', true)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — เพิ่มฟิลด์ใหม่
export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.field_key || !body.label) {
    return NextResponse.json({ error: 'field_key และ label จำเป็นต้องระบุ' }, { status: 400 })
  }
  // normalize key: lowercase, underscore
  const field_key = String(body.field_key).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')

  const { data: maxRow } = await supabaseAdmin
    .from('invoice_field_templates').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await supabaseAdmin
    .from('invoice_field_templates')
    .insert({
      field_key,
      label: body.label,
      field_type: body.field_type || 'text',
      required: !!body.required,
      sort_order: body.sort_order ?? nextOrder,
      active: true,
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
