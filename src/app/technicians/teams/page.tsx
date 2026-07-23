import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import TeamManager from './TeamManager'
export const dynamic = 'force-dynamic'

export default async function TeamsPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const [teamsRes, techsRes] = await Promise.all([
    supabaseAdmin
      .from('technician_teams')
      .select('*, members:technicians(id,name,phone,line_user_id,is_team_lead,status)')
      .eq('status', 'active')
      .order('created_at'),
    supabaseAdmin
      .from('technicians')
      .select('id,name,phone,line_user_id,status,team_id,is_team_lead')
      .eq('status', 'active')
      .order('name'),
  ])

  const teams = (teamsRes.data || []).map(t => ({
    ...t,
    members: (t.members || []).filter((m: { status: string }) => m.status === 'active'),
  }))
  const allTechs = techsRes.data || []

  return (
    <AppLayout user={session}>
      <TeamManager teams={teams} allTechs={allTechs} />
    </AppLayout>
  )
}
