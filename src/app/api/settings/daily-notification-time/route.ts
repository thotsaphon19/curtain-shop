import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'daily_notification_time').maybeSingle()
  return NextResponse.json({ value: data?.value || '08:00' })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { time } = await req.json()
  if (!time || !/^\d{2}:\d{2}$/.test(time))
    return NextResponse.json({ error: 'รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)' }, { status: 400 })

  const { error } = await supabaseAdmin.from('app_settings')
    .upsert({ key: 'daily_notification_time', value: time, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, value: time })
}
