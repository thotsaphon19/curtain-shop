import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('technicians').select('*, jobs(id, title, status, scheduled_date)').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('technicians').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: activeJobs } = await supabaseAdmin
    .from('jobs').select('id').eq('technician_id', id).in('status', ['assigned', 'heading', 'in_progress'])

  if (activeJobs && activeJobs.length > 0) {
    return NextResponse.json(
      { error: `ช่างคนนี้มีงานที่ยังไม่เสร็จ ${activeJobs.length} งาน กรุณามอบหมายงานใหม่ก่อนลบ` },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('technicians').update({ status: 'inactive' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deactivated' })
}
