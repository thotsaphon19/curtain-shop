import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import TechnicianJobCard from '../TechnicianJobCard'
import { Job } from '@/types'
export const dynamic = 'force-dynamic'

export default async function TechnicianJobDetailPage({ params }: { params: Promise<{ job: string }> }) {
  const { job: jobId } = await params
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'technician') redirect('/login')

  const { data: tech } = await supabaseAdmin
    .from('technicians').select('*').eq('line_user_id', session.line_user_id).single()
  if (!tech) redirect('/technician')

  const { data: job } = await supabaseAdmin
    .from('jobs')
    .select('*, customer:customers(name,phone,address)')
    .eq('id', jobId)
    .single()

  // งานไม่พบ หรือไม่ใช่งานของช่างคนนี้ — กลับไปหน้ารายการงานแทนที่จะโชว์ 404
  if (!job || job.technician_id !== tech.id) redirect('/technician')

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--gray)', fontFamily: 'inherit' }}>
      <header style={{ background: 'var(--dark)', padding: '0 16px', height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/technician" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}>←</a>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>รายละเอียดงาน</span>
      </header>

      <div style={{ padding: 16, maxWidth: 520, margin: '0 auto', paddingBottom: 24 }}>
        <TechnicianJobCard job={job as unknown as Job} initialExpanded />
      </div>
    </div>
  )
}
