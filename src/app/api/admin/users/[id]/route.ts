import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('*, invited_by_user:invited_by(display_name)')
    .eq('id', id).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Get activity logs for this user
  const { data: logs } = await supabaseAdmin
    .from('user_activity_logs')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ data: { ...data, activity_logs: logs || [] } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Prevent removing last admin
  if (body.role && body.role !== 'admin') {
    const { data: admins } = await supabaseAdmin
      .from('app_users').select('id').eq('role', 'admin').eq('status', 'active')
    if ((admins?.length || 0) <= 1) {
      return NextResponse.json({ error: 'ไม่สามารถลด admin คนสุดท้ายได้' }, { status: 400 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('app_users').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync to technician table if needed
  if (data.role === 'technician' && data.ref_id) {
    const patch: Record<string, unknown> = {}
    if (body.display_name) patch.name = body.display_name
    if (body.phone) patch.phone = body.phone
    if (body.status) patch.status = body.status === 'active' ? 'active' : 'inactive'
    if (Object.keys(patch).length) await supabaseAdmin.from('technicians').update(patch).eq('id', data.ref_id)
  }

  // Log
  const { data: u } = await supabaseAdmin.from('app_users').select('id').eq('line_user_id', session.line_user_id).single()
  if (u) await supabaseAdmin.from('user_activity_logs').insert({ user_id: u.id, action: 'update_user', target_type: 'app_user', target_id: id, detail: body })

  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Soft delete — set status = inactive
  const { error } = await supabaseAdmin
    .from('app_users').update({ status: 'inactive' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deactivated' })
}
