import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''

  let query = supabaseAdmin
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, phone, address, lat, lng, line_user_id, notes } = body

  if (!name || !phone || !address) {
    return NextResponse.json({ error: 'name, phone, address required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({ name, phone, address, lat, lng, line_user_id, notes })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
export const dynamic = 'force-dynamic'
