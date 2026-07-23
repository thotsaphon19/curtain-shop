import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('notify_accounts').select('*').order('account_type').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_type, name, line_user_id, oa_account_id } = await req.json()
  if (!account_type || !name || !line_user_id)
    return NextResponse.json({ error: 'account_type, name, line_user_id required' }, { status: 400 })

  if (!line_user_id.startsWith('U'))
    return NextResponse.json({ error: 'LINE User ID ต้องขึ้นต้นด้วย U' }, { status: 400 })

  const { data: dup } = await supabaseAdmin
    .from('notify_accounts').select('id,name').eq('line_user_id', line_user_id).maybeSingle()
  if (dup) return NextResponse.json({ error: `LINE ID นี้ใช้กับ "${dup.name}" อยู่แล้ว` }, { status: 409 })

  const { data, error } = await supabaseAdmin
    .from('notify_accounts').insert({ account_type, name, line_user_id, oa_account_id: oa_account_id || null }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
