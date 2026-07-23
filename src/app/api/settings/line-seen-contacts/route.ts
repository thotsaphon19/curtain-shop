import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

// GET — รายชื่อ userId/groupId ที่เคยติดต่อ LINE OA เข้ามา (ล่าสุดก่อน)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const kind = searchParams.get('kind') // 'user' | 'group' | null (ทั้งหมด)
  const search = searchParams.get('search')?.trim()

  let query = supabaseAdmin.from('line_seen_contacts').select('*').order('last_seen_at', { ascending: false })
  if (kind) query = query.eq('kind', kind)
  if (search) query = query.or(`display_name.ilike.%${search}%,line_id.ilike.%${search}%,note.ilike.%${search}%`)

  const { data, error } = await query.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // เช็คว่า userId ไหนผูกกับลูกค้า/ช่างคนไหนอยู่แล้วบ้าง จะได้โชว์ในลิสต์เลย
  // ไม่ต้องให้ลูกค้าพิมพ์เบอร์โทรมาผูกเอง และแอดมินเลือกผูกกับช่างได้ตรงนี้เลยเวลาเปลี่ยน OA
  const userIds = (data || []).filter(c => c.kind === 'user').map(c => c.line_id)
  let linkedCustomerMap: Record<string, { id: string; name: string }> = {}
  let linkedTechnicianMap: Record<string, { id: string; name: string }> = {}
  if (userIds.length > 0) {
    const [{ data: customers }, { data: technicians }] = await Promise.all([
      supabaseAdmin.from('customers').select('id, name, line_user_id').in('line_user_id', userIds),
      supabaseAdmin.from('technicians').select('id, name, line_user_id').in('line_user_id', userIds),
    ])
    linkedCustomerMap = Object.fromEntries((customers || []).map(c => [c.line_user_id, { id: c.id, name: c.name }]))
    linkedTechnicianMap = Object.fromEntries((technicians || []).map(t => [t.line_user_id, { id: t.id, name: t.name }]))
  }

  const enriched = (data || []).map(c => ({
    ...c,
    linked_customer: linkedCustomerMap[c.line_id] || null,
    linked_technician: linkedTechnicianMap[c.line_id] || null,
  }))
  return NextResponse.json({ data: enriched })
}

// PATCH — ตั้ง/แก้ "โน้ต/ชื่อเรียก" ที่แอดมินกำหนดเอง (ทดแทนฟีเจอร์ rename ใน LINE
// Official Account Manager ที่ระบบภายนอกดึงผ่าน API ไม่ได้ เป็นข้อจำกัดของ LINE เอง)
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, note } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('line_seen_contacts').update({ note: note?.trim() || null }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE — ลบรายการที่ไม่ต้องการออกจากลิสต์ (แค่ล้าง log ไม่กระทบสิทธิ์ LINE ใดๆ)
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('line_seen_contacts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deleted' })
}
