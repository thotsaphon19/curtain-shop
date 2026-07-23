import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

// GET — รายการแจ้งเตือนล่าสุด + จำนวนที่ยังไม่อ่าน
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('web_notifications').select('*').order('created_at', { ascending: false }).limit(30)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count } = await supabaseAdmin
    .from('web_notifications').select('id', { count: 'exact', head: true }).eq('read', false)

  return NextResponse.json({ data: data || [], unreadCount: count || 0 })
}

// POST — mark ทั้งหมดว่าอ่านแล้ว
export async function POST() {
  const { error } = await supabaseAdmin.from('web_notifications').update({ read: true }).eq('read', false)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'ok' })
}
