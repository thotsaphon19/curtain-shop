import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('payment_bot_accounts').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.line_user_id) return NextResponse.json({ error: 'line_user_id จำเป็นต้องระบุ' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('payment_bot_accounts')
    .insert({
      name: body.name || 'ขุนทอง (KBank)',
      line_user_id: String(body.line_user_id).trim(),
      active: true,
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
