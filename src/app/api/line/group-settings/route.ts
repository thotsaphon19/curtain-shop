import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customer_id')
  let q = supabaseAdmin
    .from('line_group_settings')
    .select('*, customer:customers(name,phone)')
    .order('created_at', { ascending: false })
  if (customerId) q = q.eq('customer_id', customerId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { customer_id, group_id, group_name, khunthong_added, auto_send } = body
  if (!customer_id || !group_id)
    return NextResponse.json({ error: 'customer_id and group_id required' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('line_group_settings')
    .upsert({ customer_id, group_id, group_name, khunthong_added, auto_send },
      { onConflict: 'customer_id' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...rest } = body
  const { data, error } = await supabaseAdmin
    .from('line_group_settings').update(rest).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('line_group_settings').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deleted' })
}
