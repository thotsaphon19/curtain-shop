import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import MapClient from './MapClient'
import { getBangkokDateString } from '@/lib/date'
export const dynamic = 'force-dynamic'

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const params = await searchParams
  const date = params.date || getBangkokDateString()

  const [techRes, jobsRes, plansRes] = await Promise.all([
    supabaseAdmin.from('technicians').select('id,name').eq('status', 'active').order('name'),
    supabaseAdmin.from('jobs')
      .select('*, customer:customers(id,name,phone,lat,lng), technician:technicians(name,id)')
      .eq('scheduled_date', date)
      .in('status', ['assigned', 'heading', 'in_progress', 'pending', 'completed'])
      .order('route_order', { ascending: true, nullsFirst: false }),
    supabaseAdmin.from('route_plans')
      .select('*, technician:technicians(name)')
      .eq('plan_date', date)
      .order('created_at', { ascending: false }),
  ])

  return (
    <AppLayout user={session}>
      <MapClient
        initialJobs={jobsRes.data || []}
        technicians={techRes.data || []}
        routePlans={plansRes.data || []}
        selectedDate={date}
        googleMapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
      />
    </AppLayout>
  )
}
