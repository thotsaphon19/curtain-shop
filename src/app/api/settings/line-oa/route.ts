import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { clearLineOACredentialsCache } from '@/lib/line-config'
export const dynamic = 'force-dynamic'

function mask(v: string | null | undefined) {
  if (!v) return null
  if (v.length <= 8) return '••••••••'
  return `${v.slice(0, 4)}${'•'.repeat(Math.max(0, v.length - 8))}${v.slice(-4)}`
}

// GET — คืนค่าสถานะ + ค่าที่ปิดบังไว้ (ไม่ส่งค่าจริงกลับไปให้ browser)
export async function GET() {
  const { data } = await supabaseAdmin
    .from('line_oa_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle()

  return NextResponse.json({
    data: {
      configured: !!(data?.channel_access_token && data?.channel_secret),
      channel_access_token_masked: mask(data?.channel_access_token),
      channel_secret_masked: mask(data?.channel_secret),
      updated_at: data?.updated_at || null,
      source: data?.channel_access_token ? 'database' : (process.env.LINE_CHANNEL_ACCESS_TOKEN ? 'env' : 'none'),
    },
  })
}

// POST — บันทึกค่าใหม่ลง DB (upsert แถวเดียว)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { channel_access_token, channel_secret } = body
  if (!channel_access_token || !channel_secret) {
    return NextResponse.json({ error: 'ต้องระบุทั้ง Channel Access Token และ Channel Secret' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin.from('line_oa_settings').select('id').limit(1).maybeSingle()

  const { error } = existing
    ? await supabaseAdmin.from('line_oa_settings')
        .update({ channel_access_token, channel_secret, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    : await supabaseAdmin.from('line_oa_settings')
        .insert({ channel_access_token, channel_secret })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  clearLineOACredentialsCache()
  return NextResponse.json({ success: true })
}
