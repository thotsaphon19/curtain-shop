import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { item_id, type, qty, note, ref_job_id } = body
  
  const { data: txn, error } = await supabaseAdmin
    .from('inventory_transactions').insert({ item_id, type, qty, note, ref_job_id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Update item qty
  const { data: item } = await supabaseAdmin.from('inventory_items').select('qty').eq('id', item_id).single()
  if (item) {
    const newQty = type === 'in' ? item.qty + qty : type === 'out' ? item.qty - qty : qty
    await supabaseAdmin.from('inventory_items').update({ qty: Math.max(0, newQty) }).eq('id', item_id)
  }
  return NextResponse.json({ data: txn })
}
