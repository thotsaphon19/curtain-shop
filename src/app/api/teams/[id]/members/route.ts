import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

// POST — เพิ่ม/ย้ายช่างเข้าทีม
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = await params
  const { technician_id, is_team_lead } = await req.json()
  if (!technician_id) return NextResponse.json({ error: 'technician_id required' }, { status: 400 })

  const { data: tech } = await supabaseAdmin.from('technicians').select('id,name,team_id').eq('id', technician_id).single()
  if (!tech) return NextResponse.json({ error: 'ไม่พบช่าง' }, { status: 404 })

  const { data: team } = await supabaseAdmin.from('technician_teams').select('name').eq('id', teamId).single()
  if (!team) return NextResponse.json({ error: 'ไม่พบทีม' }, { status: 404 })

  const isTransfer = tech.team_id && tech.team_id !== teamId

  const { data, error } = await supabaseAdmin
    .from('technicians').update({ team_id: teamId, is_team_lead: !!is_team_lead })
    .eq('id', technician_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('team_membership_logs').insert({
    technician_id, team_id: teamId,
    action: isTransfer ? 'team_changed' : 'joined',
    note: isTransfer ? `ย้ายมาทีม "${team.name}"` : `เข้าร่วมทีม "${team.name}"`,
  })

  return NextResponse.json({ data, transferred: isTransfer })
}

// DELETE — นำช่างออกจากทีม
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = await params
  const { searchParams } = new URL(req.url)
  const technicianId = searchParams.get('technician_id')
  if (!technicianId) return NextResponse.json({ error: 'technician_id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('technicians').update({ team_id: null, is_team_lead: false })
    .eq('id', technicianId).eq('team_id', teamId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('team_membership_logs').insert({
    technician_id: technicianId, team_id: teamId, action: 'left', note: 'ออกจากทีม',
  })

  return NextResponse.json({ message: 'removed' })
}
