import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

// ══════════════════════════════════════════════════════════════════════════
// ผูก userId ที่เคยทักเข้ามา (line_seen_contacts) เข้ากับลูกค้า/ช่าง "ที่มีอยู่แล้ว"
// ใช้ตอนเปลี่ยน LINE OA แล้วลูกค้า/ช่างแอดเพื่อนใหม่ — ระบบจะได้ userId ใหม่มาแทน
// ค่าเดิม โดยไม่ต้องสร้าง record ซ้ำ (ซึ่งเป็นสาเหตุที่แจ้งเตือนไม่เข้าหลังเปลี่ยน OA)
//
// นอกจากผูก userId ใหม่ให้ record ที่เลือกแล้ว ยังจะ "เคลียร์" userId เดิมนี้
// ออกจาก record อื่นที่บังเอิญมี userId เดียวกันอยู่ก่อน (เช่น record ที่ถูกสร้าง
// อัตโนมัติตอนแอดเพื่อน OA ใหม่ ซ้ำกับ record เดิมที่มีประวัติงานอยู่แล้ว)
// ══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { line_id, target_type, target_id } = await req.json()

  if (!line_id || !target_type || !target_id)
    return NextResponse.json({ error: 'line_id, target_type, target_id required' }, { status: 400 })
  if (target_type !== 'customer' && target_type !== 'technician')
    return NextResponse.json({ error: 'target_type ต้องเป็น customer หรือ technician' }, { status: 400 })

  const table = target_type === 'customer' ? 'customers' : 'technicians'

  // 1) ผูก userId ใหม่ให้ record ที่เลือก
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from(table).update({ line_user_id: line_id }).eq('id', target_id)
    .select('id, name, line_user_id').single()
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 2) หา record อื่นในตารางเดียวกันที่ถือ userId เดิมนี้อยู่ (ตัวซ้ำที่เกิดจากแอดเพื่อน OA ใหม่)
  //    แล้วเคลียร์ userId ออก กัน record เดิมที่เพิ่งผูกใหม่โดนแย่ง/สับสนตอนแจ้งเตือนครั้งถัดไป
  const { data: duplicates } = await supabaseAdmin
    .from(table).select('id, name').eq('line_user_id', line_id).neq('id', target_id)

  let clearedDuplicates: { id: string; name: string }[] = []
  if (duplicates && duplicates.length > 0) {
    const dupIds = duplicates.map(d => d.id)
    const clearBody: Record<string, unknown> = { line_user_id: null }
    if (table === 'technicians') {
      clearBody.status = 'inactive' // technicians ไม่มีคอลัมน์ notes — ปิดการใช้งานแทน
    } else {
      clearBody.notes = `⚠️ userId นี้ถูกย้ายไปผูกกับ "${updated.name}" แล้ว (${new Date().toLocaleDateString('th-TH')}) — record นี้อาจเป็นรายการซ้ำที่เกิดจากการแอดเพื่อน LINE OA ใหม่`
    }
    await supabaseAdmin.from(table).update(clearBody).in('id', dupIds)
    clearedDuplicates = duplicates
  }

  // 3) อัปเดต oa_account_id ให้ตรงกับ OA ที่ contact นี้ทักเข้ามาล่าสุด (ถ้ามี)
  const { data: contact } = await supabaseAdmin
    .from('line_seen_contacts').select('oa_account_id').eq('line_id', line_id).maybeSingle()
  if (contact?.oa_account_id) {
    await supabaseAdmin.from(table).update({ oa_account_id: contact.oa_account_id }).eq('id', target_id)
  }

  return NextResponse.json({ data: updated, cleared_duplicates: clearedDuplicates })
}
