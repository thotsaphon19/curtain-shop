import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || 'active'

  let q = supabaseAdmin
    .from('technicians')
    .select('*, jobs(id, status)')
    .order('name')

  if (status) q = q.eq('status', status)
  if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, phone, line_user_id } = body

  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('technicians')
    .insert({ name, phone, line_user_id: line_user_id || null, status: 'active' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
