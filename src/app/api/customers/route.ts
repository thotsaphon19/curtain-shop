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

  // แนบ "ชื่อเรียกที่ตั้งเอง" (ตั้งไว้ที่ Settings → คนที่เคยทัก LINE OA เข้ามา) มาด้วย
  // ใช้แสดงหลังชื่อจริงใน dropdown เลือกลูกค้า จะได้รู้ว่าเป็นลูกค้าคนไหนแน่ชัด
  const lineIds = (data || []).filter(c => c.line_user_id).map(c => c.line_user_id)
  let noteMap: Record<string, string> = {}
  if (lineIds.length > 0) {
    const { data: notes } = await supabaseAdmin.from('line_seen_contacts').select('line_id, note').in('line_id', lineIds)
    noteMap = Object.fromEntries((notes || []).filter(n => n.note).map(n => [n.line_id, n.note]))
  }
  const enriched = (data || []).map(c => ({ ...c, line_note: c.line_user_id ? noteMap[c.line_user_id] || null : null }))

  return NextResponse.json({ data: enriched })
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
