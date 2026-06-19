import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role = 'customer', note } = await req.json()

  const { data: adminUser } = await supabaseAdmin
    .from('app_users').select('id').eq('line_user_id', session.line_user_id).single()

  const { data: inv, error } = await supabaseAdmin
    .from('user_invitations')
    .insert({ role, note, invited_by: adminUser?.id || null })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const invite_url = `${appUrl}/join/${inv.token}`
  return NextResponse.json({ data: inv, invite_url })
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabaseAdmin
    .from('user_invitations')
    .select('*, invited_by_user:invited_by(display_name), used_by_user:used_by(display_name)')
    .order('created_at', { ascending: false }).limit(20)
  return NextResponse.json({ data: data || [] })
}
