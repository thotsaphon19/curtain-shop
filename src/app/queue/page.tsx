import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import QueueBoard from './QueueBoard'
export const dynamic = 'force-dynamic'

export default async function QueuePage({ searchParams }: { searchParams: Record<string, string> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  // Default: current week Mon–Sun
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const weekStart = searchParams.week_start || monday.toISOString().split('T')[0]
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(new Date(weekStart).getDate() + 6)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  const [techRes, jobsRes, slotsRes, schedRes] = await Promise.all([
    supabaseAdmin.from('technicians').select('id,name,line_user_id').eq('status', 'active').order('name'),
    supabaseAdmin.from('jobs')
      .select('*, customer:customers(name,phone,address)')
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', weekEndStr)
      .order('scheduled_date').order('scheduled_time'),
    supabaseAdmin.from('queue_slots')
      .select('*, job:jobs(id,title,status,customer:customers(name))')
      .gte('slot_date', weekStart)
      .lte('slot_date', weekEndStr)
      .order('slot_date').order('slot_start'),
    supabaseAdmin.from('technician_schedules').select('*'),
  ])

  // Unassigned jobs (no technician yet)
  const { data: unassigned } = await supabaseAdmin
    .from('jobs')
    .select('*, customer:customers(name,phone,address)')
    .eq('status', 'pending')
    .order('scheduled_date').order('priority')
    .limit(50)

  return (
    <AppLayout user={session}>
      <QueueBoard
        technicians={techRes.data || []}
        jobs={jobsRes.data || []}
        slots={slotsRes.data || []}
        schedules={schedRes.data || []}
        unassigned={unassigned || []}
        weekStart={weekStart}
        weekEnd={weekEndStr}
      />
    </AppLayout>
  )
}
