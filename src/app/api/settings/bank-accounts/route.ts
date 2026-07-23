import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('bank_accounts').select('*').eq('active', true).order('sort_order').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bank_name, account_name, account_number, branch } = await req.json()
  if (!bank_name || !account_name || !account_number)
    return NextResponse.json({ error: 'กรอกชื่อธนาคาร ชื่อบัญชี และเลขบัญชีให้ครบ' }, { status: 400 })

  const { data: maxRow } = await supabaseAdmin.from('bank_accounts').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await supabaseAdmin
    .from('bank_accounts')
    .insert({ bank_name, account_name, account_number, branch: branch || null, sort_order: nextOrder })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
