import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('quotations').select('*, customer:customers(name,phone), quotation_items(*)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { items, ...quotation } = body
  
  const { data: seq } = await supabaseAdmin.rpc('nextval', { sequence_name: 'quotation_seq' }).single()
  const quotation_no = `QT${new Date().getFullYear()}${String(seq || Date.now()).padStart(4,'0')}`
  
  const { data: qt, error } = await supabaseAdmin
    .from('quotations').insert({ ...quotation, quotation_no }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  if (items?.length) {
    await supabaseAdmin.from('quotation_items')
      .insert(items.map((i: Record<string,unknown>) => ({ ...i, quotation_id: qt.id })))
  }
  return NextResponse.json({ data: qt }, { status: 201 })
}
