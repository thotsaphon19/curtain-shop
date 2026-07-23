import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

// PATCH — แก้ไขฟิลด์ (label, field_type, required, sort_order, active)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const allowed = ['label', 'field_type', 'required', 'sort_order', 'active']
  const updates: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) updates[k] = body[k]

  const { data, error } = await supabaseAdmin
    .from('invoice_field_templates').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE — ลบฟิลด์ถาวร (ค่าที่เคยบันทึกไว้ใน invoices.custom_fields ของ invoice เก่าจะยังอยู่ แต่ฟอร์มจะไม่แสดงฟิลด์นี้อีก)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('invoice_field_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deleted' })
}
