import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import PeriodSelector, { getPeriodDates } from '@/components/ui/PeriodSelector'
import { Job } from '@/types'
import { getBangkokDateString } from '@/lib/date'
export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string,string>> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/login')

  const sp = await searchParams
  const period = sp.period || 'today'
  const { from, to, label } = getPeriodDates(period, sp.from, sp.to)
  const today = getBangkokDateString()

  const [jobsRes, overdueRes, unpaidRes, recentRes, techCountRes, custCountRes] = await Promise.all([
    supabaseAdmin.from('jobs').select('*')
      .gte('scheduled_date', from).lte('scheduled_date', to),
    supabaseAdmin.from('jobs').select('id').eq('status', 'overdue'),
    supabaseAdmin.from('invoices').select('total,paid_amount,status')
      .gte('created_at', from).lte('created_at', `${to}T23:59:59`),
    supabaseAdmin.from('jobs')
      .select('*, customer:customers(name), technician:technicians(name)')
      .order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('technicians').select('id', { count: 'exact' }).eq('status', 'active'),
    supabaseAdmin.from('customers').select('id', { count: 'exact' }),
  ])

  const jobs = jobsRes.data || []
  const invoices = unpaidRes.data || []
  const completed = jobs.filter(j => j.status === 'completed').length
  const inProgress = jobs.filter(j => j.status === 'in_progress' || j.status === 'heading').length
  const pending = jobs.filter(j => j.status === 'pending').length
  const rate = jobs.length > 0 ? Math.round(completed / jobs.length * 100) : 0
  const revenue = invoices.filter(i => i.status === 'paid').reduce((s,i) => s+(i.total||0), 0)
  const outstanding = invoices.reduce((s,i) => s+((i.total||0)-(i.paid_amount||0)), 0)

  const quickActions = [
    { href:'/jobs/new',       label:'สร้างงานใหม่',    icon:'➕', border:'var(--brand)' },
    { href:'/quotations/new', label:'ใบเสนอราคา',      icon:'📋', border:'var(--blue)' },
    { href:'/invoices/new',   label:'สร้าง Invoice',   icon:'💳', border:'var(--amber)' },
    { href:'/map',            label:'ดูแผนที่',         icon:'🗺️', border:'var(--purple)' },
  ]

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">สวัสดี คุณ{session.display_name} 👋</h1>
            <p className="page-subtitle">
              {new Date().toLocaleDateString('th-TH',{ weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            </p>
          </div>
        </div>

        {/* Period selector */}
        <PeriodSelector action="/dashboard" currentPeriod={period} currentFrom={from} currentTo={to} />

        {/* Stats */}
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          {[
            { label:`งาน (${label})`, value:jobs.length,    icon:'🔧', color:'var(--blue)',   bg:'var(--blue-lt)' },
            { label:'เสร็จแล้ว',      value:completed,      icon:'✅', color:'var(--green)',  bg:'var(--green-lt)' },
            { label:'กำลังทำ',        value:inProgress,     icon:'⚙️', color:'var(--purple)', bg:'var(--purple-lt)' },
            { label:'รอมอบหมาย',     value:pending,        icon:'⏳', color:'var(--amber)',  bg:'var(--amber-lt)' },
            { label:'งานค้าง',        value:overdueRes.data?.length||0, icon:'⚠️', color:'var(--red)', bg:'var(--red-lt)' },
            { label:'สำเร็จ %',       value:`${rate}%`,     icon:'📊', color:'var(--brand)',  bg:'var(--brand-lt)' },
            { label:'รายได้',         value:`฿${revenue.toLocaleString()}`, icon:'💰', color:'var(--green)', bg:'var(--green-lt)' },
            { label:'ค้างชำระ',       value:`฿${outstanding.toLocaleString()}`, icon:'💳', color:'var(--red)', bg:'var(--red-lt)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize:20, background:s.bg, borderRadius:8, padding:'4px 7px', display:'inline-block', marginBottom:6 }}>{s.icon}</div>
              <div className="stat-value" style={{ color:s.color, fontSize:20 }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Summary row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
          {[
            { label:'ช่างทั้งหมด', value:techCountRes.count||0, icon:'👷', href:'/technicians' },
            { label:'ลูกค้าทั้งหมด', value:custCountRes.count||0, icon:'👤', href:'/customers' },
          ].map(s => (
            <a key={s.label} href={s.href} style={{ textDecoration:'none' }}>
              <div className="card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ fontSize:24 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize:20, fontWeight:800, color:'var(--dark)' }}>{s.value}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>{s.label}</div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:20 }}>
          {quickActions.map(a => (
            <a key={a.href} href={a.href} style={{ textDecoration:'none' }}>
              <div className="card" style={{ padding:'14px 16px', textAlign:'center', border:`2px solid ${a.border}`, cursor:'pointer' }}>
                <div style={{ fontSize:24, marginBottom:6 }}>{a.icon}</div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--dark)' }}>{a.label}</div>
              </div>
            </a>
          ))}
        </div>

        {/* Recent jobs */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">🕐 งานล่าสุด</span>
            <a href="/jobs" style={{ fontSize:12, color:'var(--brand)', fontWeight:600 }}>ดูทั้งหมด →</a>
          </div>
          <div>
            {(recentRes.data as unknown as Job[] || []).map(job => (
              <div key={job.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid #f5f5f5' }}>
                <div>
                  <a href={`/jobs/${job.id}`} style={{ fontWeight:700, fontSize:14, color:'var(--dark)' }}>{job.title}</a>
                  <div className="text-xs text-muted">
                    {(job as unknown as {customer:{name:string}}).customer?.name} · {job.scheduled_date}
                  </div>
                </div>
                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
