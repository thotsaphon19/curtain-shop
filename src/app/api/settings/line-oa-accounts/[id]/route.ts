import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
import { clearLineOACredentialsCache } from '@/lib/line-config'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // ตั้งเป็น default ตัวใหม่ → ปลด default ตัวเก่าออกก่อนเสมอ (มี default ได้แค่ตัวเดียว)
  if (body.is_default) {
    await supabaseAdmin.from('line_oa_accounts').update({ is_default: false }).eq('is_default', true).neq('id', id)
  }

  const { data, error } = await supabaseAdmin
    .from('line_oa_accounts')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, is_default, active, updated_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  clearLineOACredentialsCache()
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: acc } = await supabaseAdmin.from('line_oa_accounts').select('is_default').eq('id', id).maybeSingle()
  if (acc?.is_default)
    return NextResponse.json({ error: 'ลบบัญชี default ไม่ได้ กรุณาตั้งบัญชีอื่นเป็น default ก่อน' }, { status: 400 })

  const { error } = await supabaseAdmin.from('line_oa_accounts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  clearLineOACredentialsCache()
  return NextResponse.json({ message: 'deleted' })
}
