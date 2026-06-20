import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const role   = searchParams.get('role')
  const status = searchParams.get('status') || 'active'
  const search = searchParams.get('search') || ''

  let q = supabaseAdmin
    .from('app_users')
    .select('*, invited_by_user:invited_by(display_name)')
    .order('created_at', { ascending: false })

  if (role)   q = q.eq('role', role)
  if (status) q = q.eq('status', status)
  if (search) q = q.ilike('display_name', `%${search}%`)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { display_name, phone, email, role, notes, line_user_id, permissions } = body

  if (!display_name || !role)
    return NextResponse.json({ error: 'display_name and role required' }, { status: 400 })

  // Find current admin's app_user record for invited_by
  const { data: adminUser } = await supabaseAdmin
    .from('app_users').select('id').eq('line_user_id', session.line_user_id).single()

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .insert({ display_name, phone, email, role, notes, line_user_id, permissions: permissions || {},
      invited_by: adminUser?.id || null })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If technician role, also create technician record
  if (role === 'technician' && phone) {
    const { data: tech } = await supabaseAdmin
      .from('technicians')
      .upsert({ name: display_name, phone, line_user_id: line_user_id || null, status: 'active' }, { onConflict: 'line_user_id' })
      .select().single()
    if (tech) {
      await supabaseAdmin.from('app_users').update({ ref_id: tech.id }).eq('id', data.id)
    }
  }

  // Log activity
  await logActivity(session.line_user_id, 'create_user', 'app_user', data.id, { role, display_name })

  return NextResponse.json({ data }, { status: 201 })
}

async function logActivity(lineUserId: string, action: string, targetType: string, targetId: string, detail: object) {
  const { data: u } = await supabaseAdmin.from('app_users').select('id').eq('line_user_id', lineUserId).single()
  if (u) await supabaseAdmin.from('user_activity_logs').insert({ user_id: u.id, action, target_type: targetType, target_id: targetId, detail })
}
