import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getBangkokDateString } from '@/lib/date'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateFrom = searchParams.get('from') || getBangkokDateString()
  const dateTo = searchParams.get('to') || dateFrom

  const { data: jobs, error } = await supabaseAdmin
    .from('jobs')
    .select(`*, technician:technicians(name), customer:customers(name)`)
    .gte('scheduled_date', dateFrom)
    .lte('scheduled_date', dateTo)
    .order('scheduled_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = jobs?.length || 0
  const completed = jobs?.filter(j => j.status === 'completed').length || 0
  const overdue = jobs?.filter(j => j.status === 'overdue').length || 0
  const cancelled = jobs?.filter(j => j.status === 'cancelled').length || 0
  const pending = jobs?.filter(j => ['pending','assigned','heading','in_progress'].includes(j.status)).length || 0

  return NextResponse.json({
    data: {
      summary: { total, completed, overdue, cancelled, pending },
      jobs,
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  })
}
export const dynamic = 'force-dynamic'
