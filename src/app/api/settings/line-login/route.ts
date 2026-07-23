import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { clearLineLoginCredentialsCache } from '@/lib/line-login-config'
export const dynamic = 'force-dynamic'

function mask(v: string | null | undefined) {
  if (!v) return null
  if (v.length <= 8) return '••••••••'
  return `${v.slice(0, 4)}${'•'.repeat(Math.max(0, v.length - 8))}${v.slice(-4)}`
}

// GET — คืนค่าสถานะ + ค่าที่ปิดบังไว้ (ไม่ส่งค่าจริงกลับไปให้ browser)
export async function GET() {
  const { data } = await supabaseAdmin
    .from('line_login_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle()

  return NextResponse.json({
    data: {
      configured: !!(data?.client_id && data?.client_secret),
      client_id_masked: mask(data?.client_id),
      client_secret_masked: mask(data?.client_secret),
      updated_at: data?.updated_at || null,
      source: data?.client_id ? 'database' : (process.env.LINE_LOGIN_CLIENT_ID ? 'env' : 'none'),
    },
  })
}

// POST — บันทึกค่าใหม่ลง DB (upsert แถวเดียว) มีผลทันที ไม่ต้อง redeploy
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { client_id, client_secret } = await req.json()
  if (!client_id || !client_secret) {
    return NextResponse.json({ error: 'ต้องระบุทั้ง Channel ID และ Channel Secret' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin.from('line_login_settings').select('id').limit(1).maybeSingle()

  const { error } = existing
    ? await supabaseAdmin.from('line_login_settings')
        .update({ client_id, client_secret, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    : await supabaseAdmin.from('line_login_settings').insert({ client_id, client_secret })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  clearLineLoginCredentialsCache()
  return NextResponse.json({ success: true })
}
