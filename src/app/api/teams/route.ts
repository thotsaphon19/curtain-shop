import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('technician_teams')
    .select('*, members:technicians(id,name,phone,line_user_id,is_team_lead,status)')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, line_group_id, line_group_name, notes } = body
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  if (line_group_id) {
    const { data: dup } = await supabaseAdmin
      .from('technician_teams').select('id,name').eq('line_group_id', line_group_id).maybeSingle()
    if (dup) return NextResponse.json({ error: `LINE Group นี้ใช้กับทีม "${dup.name}" อยู่แล้ว` }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('technician_teams').insert({ name, line_group_id: line_group_id || null, line_group_name, notes }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
