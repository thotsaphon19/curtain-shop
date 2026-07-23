import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import TechnicianRoutePanel from './TechnicianRoutePanel'
import MapClient from '@/app/map/MapClient'
import { Job } from '@/types'
import { getBangkokDateString } from '@/lib/date'
export const dynamic = 'force-dynamic'

export default async function TechnicianPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'technician') redirect('/login')

  const { data: tech } = await supabaseAdmin.from('technicians').select('*').eq('line_user_id', session.line_user_id).single()
  const today = getBangkokDateString()

  const todayJobs = tech ? (await supabaseAdmin.from('jobs').select('*, customer:customers(name,phone,address)').eq('technician_id',tech.id).eq('scheduled_date',today).order('scheduled_time')).data||[] : []
  const pendingJobs = tech ? (await supabaseAdmin.from('jobs').select('*, customer:customers(name)').eq('technician_id',tech.id).in('status',['assigned','heading','in_progress']).neq('scheduled_date',today).order('scheduled_date').limit(5)).data||[] : []

  // ── ข้อมูลสำหรับฝังแผนที่จริง (พร้อมหมุด) ไว้ในหน้านี้เลย ──────────────────
  const [mapJobsRes, plansRes] = tech ? await Promise.all([
    supabaseAdmin.from('jobs')
      .select('*, customer:customers(id,name,phone,lat,lng), technician:technicians(name,id)')
      .eq('scheduled_date', today)
      .eq('technician_id', tech.id)
      .in('status', ['assigned', 'heading', 'in_progress', 'pending', 'completed'])
      .order('route_order', { ascending: true, nullsFirst: false }),
    supabaseAdmin.from('route_plans')
      .select('*, technician:technicians(name)')
      .eq('plan_date', today)
      .eq('technician_id', tech.id)
      .order('created_at', { ascending: false }),
  ]) : [{ data: [] }, { data: [] }]

  return (
    <div style={{minHeight:'100dvh',background:'var(--gray)',fontFamily:'inherit'}}>
      <header style={{background:'var(--dark)',padding:'0 16px',height:'var(--topbar-h)',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
        {session.picture_url
          ? <img src={session.picture_url} alt="" style={{width:32,height:32,borderRadius:'50%'}}/>
          : <div style={{width:32,height:32,borderRadius:'50%',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center'}}>👷</div>
        }
        <div style={{flex:1}}>
          <div style={{color:'#fff',fontWeight:700,fontSize:14}}>{session.display_name}</div>
          <div style={{color:'rgba(255,255,255,0.45)',fontSize:10}}>ช่างติดตั้ง</div>
        </div>
        <a href="/api/auth/logout" style={{color:'rgba(255,255,255,0.45)',fontSize:12}}>ออก</a>
      </header>

      <div style={{padding:'16px',maxWidth:520,margin:'0 auto',paddingBottom:24}}>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
          {[
            {label:'วันนี้',value:todayJobs.length,color:'var(--blue)',bg:'var(--blue-lt)'},
            {label:'เสร็จ',value:todayJobs.filter((j:unknown)=>(j as Job).status==='completed').length,color:'var(--green)',bg:'var(--green-lt)'},
            {label:'ค้าง',value:pendingJobs.length,color:'var(--amber)',bg:'var(--amber-lt)'},
          ].map(s=>(
            <div key={s.label} style={{background:'var(--white)',borderRadius:12,padding:'12px 10px',textAlign:'center',boxShadow:'var(--shadow-sm)'}}>
              <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.value}</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── แผนที่จริง (หมุด + AI วางเส้นทาง) ฝังอยู่ในหน้านี้เลย ── */}
        {tech && (
          <div style={{ marginBottom: 12 }}>
            <div className="job-map-embed">
              <MapClient
                initialJobs={mapJobsRes.data || []}
                technicians={[{ id: tech.id, name: tech.name }]}
                routePlans={plansRes.data || []}
                selectedDate={today}
                googleMapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
                lockTechnicianId={tech.id}
                basePath="/technician"
                embedded
              />
            </div>
          </div>
        )}
        <a href={`/technician/map?date=${today}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'var(--dark)', color: '#fff', borderRadius: 12, padding: '10px',
          marginBottom: 20, textDecoration: 'none', fontWeight: 700, fontSize: 12,
        }}>
          ⛶ ขยายแผนที่เต็มหน้าจอ
        </a>

        {/* ── เส้นทางแนะนำ (AI + ตำแหน่งปัจจุบัน) + รายการงานวันนี้ ── */}
        <div style={{ marginBottom:24 }}>
          <TechnicianRoutePanel
            technicianId={tech?.id || ''}
            date={today}
            initialJobs={todayJobs as unknown as (Job & { lat?: number; lng?: number; customer: { name: string; phone: string; address: string } })[]}
          />
        </div>

        {pendingJobs.length>0&&(
          <>
            <h2 style={{fontSize:14,fontWeight:700,margin:'0 0 10px',color:'var(--dark)'}}>📋 งานค้างอยู่</h2>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {(pendingJobs as unknown as Job[]).map(job=>(
                <a key={job.id} href={`/technician/${job.id}`} style={{textDecoration:'none',color:'inherit',background:'var(--white)',borderRadius:12,padding:'12px 14px',boxShadow:'var(--shadow-sm)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700}}>{job.title}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>📅 {job.scheduled_date}</div>
                  </div>
                  <span className={`badge ${job.status==='in_progress'?'badge-brand':'badge-blue'}`}>{job.status==='in_progress'?'กำลังทำ':'มอบหมาย'}</span>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
