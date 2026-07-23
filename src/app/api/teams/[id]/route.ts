import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  if (body.line_group_id) {
    const { data: dup } = await supabaseAdmin
      .from('technician_teams').select('id,name').eq('line_group_id', body.line_group_id).neq('id', id).maybeSingle()
    if (dup) return NextResponse.json({ error: `LINE Group นี้ใช้กับทีม "${dup.name}" อยู่แล้ว` }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('technician_teams').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: members } = await supabaseAdmin
    .from('technicians').select('id').eq('team_id', id).eq('status', 'active')
  if (members && members.length > 0)
    return NextResponse.json({ error: `ทีมนี้มีช่าง ${members.length} คน กรุณาย้ายออกก่อนลบ` }, { status: 400 })

  const { error } = await supabaseAdmin.from('technician_teams').update({ status: 'inactive' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deleted' })
}
