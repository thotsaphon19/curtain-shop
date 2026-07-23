import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import { Job } from '@/types'
import TechnicianActions from './TechnicianActions'
export const dynamic = 'force-dynamic'

export default async function TechnicianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const { data: tech, error } = await supabaseAdmin
    .from('technicians')
    .select('*, jobs(id, title, status, scheduled_date, customer:customers(name))')
    .eq('id', id).single()

  if (error || !tech) redirect('/technicians')

  const jobs = ((tech.jobs || []) as unknown as (Job & { customer: { name: string } })[])
    .sort((a, b) => (b.scheduled_date || '').localeCompare(a.scheduled_date || ''))

  const activeJobs = jobs.filter(j => ['assigned', 'heading', 'in_progress'].includes(j.status))
  const doneJobs = jobs.filter(j => j.status === 'completed')

  return (
    <AppLayout user={session}>
      <div style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <a href="/technicians" style={{ color: 'var(--text-muted)', fontSize: 14 }}>← ช่างทั้งหมด</a>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--dark)', flex: 1 }}>👷 {tech.name}</h1>
          <span className={`badge ${tech.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
            {tech.status === 'active' ? 'ทำงานอยู่' : 'ปิดใช้งาน'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Info + edit form */}
          <TechnicianActions technician={tech} />

          {/* Job stats */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)', marginBottom: 14 }}>สถิติงาน</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--dark)' }}>{jobs.length}</div>
                <div className="text-xs text-muted">งานทั้งหมด</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--amber)' }}>{activeJobs.length}</div>
                <div className="text-xs text-muted">กำลังทำ</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{doneJobs.length}</div>
                <div className="text-xs text-muted">เสร็จแล้ว</div>
              </div>
            </div>
          </div>
        </div>

        {/* Job history */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-header"><span className="section-title">🔧 ประวัติงาน</span></div>
          {jobs.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>ยังไม่มีงาน</div>
          ) : (
            <div>
              {jobs.map(job => (
                <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f5f5f5' }}>
                  <div>
                    <a href={`/jobs/${job.id}`} style={{ fontWeight: 700, fontSize: 14, color: 'var(--dark)' }}>{job.title}</a>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                      {job.scheduled_date} · {job.customer?.name || '-'}
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
