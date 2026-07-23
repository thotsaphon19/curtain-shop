import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('customers').select('*, jobs(*)').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('customers').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // ห้ามลบถ้ามีงานหรือ Invoice ผูกอยู่ — ป้องกันข้อมูลขาดหายโดยไม่ตั้งใจ
  const [{ data: jobs }, { data: invoices }] = await Promise.all([
    supabaseAdmin.from('jobs').select('id').eq('customer_id', id).limit(1),
    supabaseAdmin.from('invoices').select('id').eq('customer_id', id).limit(1),
  ])

  if ((jobs && jobs.length > 0) || (invoices && invoices.length > 0)) {
    return NextResponse.json(
      { error: 'ลูกค้ารายนี้มีประวัติงานหรือ Invoice อยู่ ไม่สามารถลบได้ (เก็บไว้เป็นประวัติ)' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deleted' })
}
