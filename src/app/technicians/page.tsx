import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import SearchBar from '@/components/ui/SearchBar'
export const dynamic = 'force-dynamic'

export default async function TechniciansPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const { q = '' } = await searchParams

  let query = supabaseAdmin.from('technicians').select('*, jobs(id, status)').eq('status', 'active').order('name')
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  const { data: technicians } = await query

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div><h1 className="page-title">👷 ช่าง</h1><p className="page-subtitle">ช่างติดตั้งทั้งหมด {technicians?.length||0} คน</p></div>
          <a href="/technicians/new" className="btn btn-primary">+ เพิ่มช่าง</a>
        </div>

        <SearchBar action="/technicians" placeholder="ค้นหาชื่อช่างหรือเบอร์โทร..." defaultValue={q} />

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14, marginTop:16}}>
          {(technicians||[]).map(tech => {
            const jobs=(tech as unknown as {jobs:{status:string}[]}).jobs||[]
            const active=jobs.filter(j=>['assigned','in_progress'].includes(j.status)).length
            const done=jobs.filter(j=>j.status==='completed').length
            return (
              <div key={tech.id} className="card" style={{padding:18}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{fontSize:15,fontWeight:700}}>👷 {tech.name}</div>
                  <span className={`badge ${active>0?'badge-brand':'badge-gray'}`}>{active>0?`งาน ${active}`:' ว่าง'}</span>
                </div>
                <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:4}}>📱 {tech.phone}</div>
                <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:10}}>
                  Line: {tech.line_user_id?<span style={{color:'var(--green)'}}>✅ ผูกแล้ว</span>:<span style={{color:'var(--text-muted)'}}>ยังไม่ผูก</span>}
                </div>
                <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text-muted)',borderTop:'1px solid var(--border)',paddingTop:10,marginBottom:12}}>
                  <span>งานทั้งหมด: <strong style={{color:'var(--text)'}}>{jobs.length}</strong></span>
                  <span>เสร็จ: <strong style={{color:'var(--green)'}}>{done}</strong></span>
                </div>
                <a href={`/technicians/${tech.id}`} className="btn btn-secondary" style={{width:'100%',justifyContent:'center'}}>แก้ไข / ดูงาน</a>
              </div>
            )
          })}
          {!technicians?.length&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:32,color:'var(--text-muted)'}}>{q ? `ไม่พบช่างที่ตรงกับ "${q}"` : 'ยังไม่มีช่าง'}</div>}
        </div>
      </div>
    </AppLayout>
  )
}
