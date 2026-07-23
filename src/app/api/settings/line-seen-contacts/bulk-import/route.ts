import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

// ══════════════════════════════════════════════════════════════════════════
// ดึงลูกค้าที่เคยแอดเพื่อน/ทัก LINE OA เข้ามา (อยู่ในตาราง line_seen_contacts)
// แต่ยังไม่เคยถูกสร้างเป็น "ลูกค้า" ในระบบ → สร้างให้อัตโนมัติทีเดียวทั้งหมด
// พร้อมผูก line_user_id ให้เลย จะได้รับแจ้งเตือนได้ทันที
//
// ใช้แก้เคส: คนที่แอดเพื่อน OA ใหม่ไปแล้วตั้งแต่ก่อนหน้านี้ (ตอน webhook ยังไม่พร้อม
// หรือระบบ auto-create ตอน follow event พลาดไปด้วยเหตุผลอะไรก็ตาม) ให้ไม่ต้องมานั่ง
// ผูกทีละคนที่หน้า Settings — กดปุ่มเดียวดึงเข้ามาเป็นลูกค้าให้หมดในคราวเดียว
//
// หมายเหตุ: ไม่แตะคนที่มีชื่อ/เบอร์ตรงกับลูกค้าเดิมอยู่แล้ว เพราะไม่รู้แน่ชัดว่าใช่คนเดียวกันไหม
// (ต้องผูกแบบระบุตัวตนชัดเจนที่หน้า Settings → คนที่เคยทัก LINE OA เข้ามา แทน)
// ══════════════════════════════════════════════════════════════════════════

export async function POST(_req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1) รายชื่อ userId ทั้งหมดที่เคยทัก/แอดเพื่อน OA เข้ามา (เฉพาะบุคคล ไม่รวมกลุ่ม)
  const { data: seenContacts, error: seenErr } = await supabaseAdmin
    .from('line_seen_contacts').select('line_id, display_name, picture_url, oa_account_id').eq('kind', 'user')
  if (seenErr) return NextResponse.json({ error: seenErr.message }, { status: 500 })
  if (!seenContacts || seenContacts.length === 0)
    return NextResponse.json({ imported: 0, skipped: 0, total: 0 })

  const userIds = seenContacts.map(c => c.line_id)

  // 2) userId ที่ผูกกับลูกค้าหรือช่างอยู่แล้ว (ไม่ต้องสร้างซ้ำ)
  const [{ data: linkedCustomers }, { data: linkedTechnicians }] = await Promise.all([
    supabaseAdmin.from('customers').select('line_user_id').in('line_user_id', userIds),
    supabaseAdmin.from('technicians').select('line_user_id').in('line_user_id', userIds),
  ])
  const alreadyLinked = new Set([
    ...(linkedCustomers || []).map(c => c.line_user_id),
    ...(linkedTechnicians || []).map(t => t.line_user_id),
  ])

  const toImport = seenContacts.filter(c => !alreadyLinked.has(c.line_id))

  let imported = 0
  const errors: string[] = []
  for (const c of toImport) {
    const { error } = await supabaseAdmin.from('customers').insert({
      name: c.display_name || 'ลูกค้าใหม่ (LINE)',
      phone: '',
      address: '',
      line_user_id: c.line_id,
      oa_account_id: c.oa_account_id || null,
      notes: 'นำเข้าอัตโนมัติจากคนที่เคยแอดเพื่อน/ทัก LINE OA — กรอกเบอร์โทร/ที่อยู่เพิ่มได้ที่นี่',
    })
    if (error) errors.push(`${c.display_name || c.line_id}: ${error.message}`)
    else imported++
  }

  return NextResponse.json({
    imported, skipped: seenContacts.length - toImport.length, total: seenContacts.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
