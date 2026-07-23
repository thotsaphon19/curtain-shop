import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('internal_line_groups')
    .select('*').order('group_type').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { group_type, name, line_group_id, description, notify_events, oa_account_id } = body

  if (!group_type || !name || !line_group_id)
    return NextResponse.json({ error: 'group_type, name, line_group_id required' }, { status: 400 })

  if (!line_group_id.startsWith('C'))
    return NextResponse.json({ error: 'LINE Group ID ต้องขึ้นต้นด้วย C' }, { status: 400 })

  const { data: dup } = await supabaseAdmin
    .from('internal_line_groups').select('id,name').eq('line_group_id', line_group_id).maybeSingle()
  if (dup) return NextResponse.json({ error: `Group ID นี้ใช้กับ "${dup.name}" อยู่แล้ว` }, { status: 409 })

  const { data, error } = await supabaseAdmin
    .from('internal_line_groups')
    .insert({ group_type, name, line_group_id, description, notify_events: notify_events || [], oa_account_id: oa_account_id || null })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
