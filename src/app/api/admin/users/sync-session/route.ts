import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

// POST — sync role จาก app_users ไป user_sessions + สร้าง technician/customer record
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { line_user_id, role, phone, display_name } = await req.json()
  if (!line_user_id || !role)
    return NextResponse.json({ error: 'line_user_id and role required' }, { status: 400 })

  // 1. อัปเดต role ใน user_sessions
  await supabaseAdmin
    .from('user_sessions')
    .update({ role })
    .eq('line_user_id', line_user_id)

  // 2. ถ้าเป็น technician → สร้างหรืออัปเดตใน technicians table
  if (role === 'technician') {
    const { data: existing } = await supabaseAdmin
      .from('technicians').select('id').eq('line_user_id', line_user_id).maybeSingle()

    if (!existing && display_name) {
      const { data: newTech } = await supabaseAdmin.from('technicians')
        .insert({ name: display_name, phone: phone || '', line_user_id, status: 'active' })
        .select().single()

      // ผูก ref_id ใน app_users
      if (newTech) {
        await supabaseAdmin.from('app_users')
          .update({ ref_id: newTech.id })
          .eq('line_user_id', line_user_id)
      }
    } else if (existing && phone) {
      await supabaseAdmin.from('technicians').update({ phone }).eq('id', existing.id)
    }
  }

  // 3. ถ้าเป็น customer → สร้างหรืออัปเดตใน customers table
  if (role === 'customer') {
    const { data: existing } = await supabaseAdmin
      .from('customers').select('id').eq('line_user_id', line_user_id).maybeSingle()

    if (!existing && display_name) {
      await supabaseAdmin.from('customers').insert({
        name: display_name, phone: phone || '', address: '-', line_user_id,
      })
    }
  }

  return NextResponse.json({ message: 'synced' })
}
