import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { clearLineOACredentialsCache } from '@/lib/line-config'
export const dynamic = 'force-dynamic'

function mask(v: string | null | undefined) {
  if (!v) return null
  if (v.length <= 8) return '••••••••'
  return `${v.slice(0, 4)}${'•'.repeat(Math.max(0, v.length - 8))}${v.slice(-4)}`
}

// GET — รายชื่อบัญชี OA ทั้งหมด (token/secret แสดงแบบปิดบัง ไม่ส่งค่าจริงกลับ browser)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('line_oa_accounts')
    .select('id, name, is_default, active, channel_access_token, channel_secret, created_at, updated_at')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const masked = (data || []).map(a => ({
    id: a.id,
    name: a.name,
    is_default: a.is_default,
    active: a.active,
    created_at: a.created_at,
    updated_at: a.updated_at,
    channel_access_token_masked: mask(a.channel_access_token),
    channel_secret_masked: mask(a.channel_secret),
  }))
  return NextResponse.json({ data: masked })
}

// POST — เพิ่มบัญชี OA ใหม่
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, channel_access_token, channel_secret, is_default } = body

  if (!name || !channel_access_token || !channel_secret)
    return NextResponse.json({ error: 'ต้องระบุ ชื่อบัญชี, Channel Access Token และ Channel Secret' }, { status: 400 })

  // ถ้าตั้งเป็น default ตัวใหม่ ต้องปลด default ตัวเก่าออกก่อน (มี default ได้แค่ตัวเดียว)
  if (is_default) {
    await supabaseAdmin.from('line_oa_accounts').update({ is_default: false }).eq('is_default', true)
  }

  const { data, error } = await supabaseAdmin
    .from('line_oa_accounts')
    .insert({ name, channel_access_token, channel_secret, is_default: !!is_default })
    .select('id, name, is_default, active, created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  clearLineOACredentialsCache()
  return NextResponse.json({ data }, { status: 201 })
}
