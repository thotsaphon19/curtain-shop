import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import MapClient from '@/app/map/MapClient'
import { getBangkokDateString } from '@/lib/date'
export const dynamic = 'force-dynamic'

export default async function TechnicianMapPage({ searchParams }: { searchParams: Promise<Record<string,string>> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'technician') redirect('/login')

  const { data: tech } = await supabaseAdmin.from('technicians').select('id,name').eq('line_user_id', session.line_user_id).single()
  if (!tech) redirect('/technician')

  const { date: dateParam } = await searchParams
  const date = dateParam || getBangkokDateString()

  const [jobsRes, plansRes] = await Promise.all([
    supabaseAdmin.from('jobs')
      .select('*, customer:customers(id,name,phone,lat,lng), technician:technicians(name,id)')
      .eq('scheduled_date', date)
      .eq('technician_id', tech.id)
      .in('status', ['assigned', 'heading', 'in_progress', 'pending', 'completed'])
      .order('route_order', { ascending: true, nullsFirst: false }),
    supabaseAdmin.from('route_plans')
      .select('*, technician:technicians(name)')
      .eq('plan_date', date)
      .eq('technician_id', tech.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--gray)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--dark)', padding: '0 16px', height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <a href="/technician" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}>←</a>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>🗺️ แผนที่ + เส้นทางของฉัน</span>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <MapClient
          initialJobs={jobsRes.data || []}
          technicians={[tech]}
          routePlans={plansRes.data || []}
          selectedDate={date}
          googleMapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
          lockTechnicianId={tech.id}
          basePath="/technician/map"
        />
      </div>
    </div>
  )
}
