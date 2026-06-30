import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import StatusBadge from '@/components/ui/StatusBadge'
import { Job } from '@/types'
export const dynamic = 'force-dynamic'

export default async function CustomerPortalPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'customer') redirect('/login')

  const { data: customer } = await supabaseAdmin.from('customers').select('*').eq('line_user_id', session.line_user_id).single()
  const jobs = customer ? (await supabaseAdmin.from('jobs').select('*, technician:technicians(name,phone)').eq('customer_id',customer.id).order('scheduled_date',{ascending:false}).limit(20)).data||[] : []
  const invoices = customer ? (await supabaseAdmin.from('invoices').select('*').eq('customer_id',customer.id).order('created_at',{ascending:false})).data||[] : []
  const totalOwed = invoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+((i.total||0)-(i.paid_amount||0)),0)

  return (
    <div style={{minHeight:'100dvh',background:'var(--gray)'}}>
      <header style={{background:'var(--dark)',padding:'0 16px',height:'var(--topbar-h)',display:'flex',alignItems:'center',gap:10,position:'sticky',top:0,zIndex:10}}>
        <span style={{fontSize:22}}>🪟</span>
        <div style={{flex:1}}>
          <div style={{color:'#fff',fontWeight:700,fontSize:14}}>ร้านผ้าม่าน</div>
          <div style={{color:'rgba(255,255,255,0.45)',fontSize:10}}>สวัสดี คุณ{session.display_name}</div>
        </div>
        <a href="/api/auth/logout" style={{color:'rgba(255,255,255,0.45)',fontSize:12}}>ออก</a>
      </header>

      <div style={{maxWidth:560,margin:'0 auto',padding:'16px',paddingBottom:32}}>
        {totalOwed>0&&(
          <div className="alert alert-warning mb-16" style={{marginBottom:16}}>
            <span style={{fontSize:28}}>💳</span>
            <div>
              <div style={{fontWeight:800,fontSize:16}}>฿{totalOwed.toLocaleString()} บาท</div>
              <div style={{fontSize:12}}>ยอดค้างชำระ {invoices.filter(i=>i.status!=='paid').length} Invoice</div>
            </div>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
          {[
            {label:'งานทั้งหมด',value:jobs.length,color:'var(--blue)',bg:'var(--blue-lt)',icon:'🔧'},
            {label:'กำลังดำเนินการ',value:jobs.filter((j:unknown)=>['assigned','in_progress'].includes((j as Job).status)).length,color:'var(--amber)',bg:'var(--amber-lt)',icon:'⏳'},
          ].map(s=>(
            <div key={s.label} style={{background:'var(--white)',borderRadius:12,padding:'16px',boxShadow:'var(--shadow-sm)',textAlign:'center'}}>
              <div style={{fontSize:28,background:s.bg,borderRadius:10,padding:8,display:'inline-block',marginBottom:8}}>{s.icon}</div>
              <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.value}</div>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>{s.label}</div>
            </div>
          ))}
        </div>

        <h2 style={{fontSize:15,fontWeight:700,margin:'0 0 10px'}}>งานของคุณ</h2>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
          {(jobs as unknown as Job[]).map(job => {
            const tech=(job as unknown as {technician:{name:string,phone:string}}).technician
            return (
              <div key={job.id} style={{background:'var(--white)',borderRadius:12,padding:'14px 16px',boxShadow:'var(--shadow-sm)'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{fontWeight:700,fontSize:14}}>{job.title}</div>
                  <StatusBadge status={job.status}/>
                </div>
                <div style={{fontSize:12,color:'var(--text-muted)',display:'flex',flexDirection:'column',gap:3}}>
                  <span>📅 {job.scheduled_date} ⏰ {job.scheduled_time?.slice(0,5)}</span>
                  <span>📍 {job.address}</span>
                  {tech&&<span>👷 ช่าง: {tech.name} (<a href={`tel:${tech.phone}`} style={{color:'var(--brand)'}}>{tech.phone}</a>)</span>}
                  {job.end_photo_url&&<img src={job.end_photo_url} alt="งาน" style={{width:'100%',maxWidth:280,borderRadius:8,objectFit:'cover',maxHeight:160,marginTop:6}}/>}
                </div>
              </div>
            )
          })}
          {!jobs.length&&<div style={{background:'var(--white)',borderRadius:12,padding:'24px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>ยังไม่มีงาน</div>}
        </div>

        <h2 style={{fontSize:15,fontWeight:700,margin:'0 0 10px'}}>ใบแจ้งหนี้</h2>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {invoices.map(inv=>(
            <div key={inv.id} style={{background:'var(--white)',borderRadius:12,padding:'14px 16px',boxShadow:'var(--shadow-sm)',borderLeft:`4px solid ${inv.status==='paid'?'var(--green)':'var(--red)'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontWeight:700,fontSize:14}}>{inv.invoice_no}</span>
                <span className={`badge ${inv.status==='paid'?'badge-green':inv.status==='partial'?'badge-amber':'badge-red'}`}>
                  {inv.status==='paid'?'✅ ชำระแล้ว':inv.status==='partial'?'🔄 บางส่วน':'⏳ รอชำระ'}
                </span>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>฿{(inv.total||0).toLocaleString()}</div>
              {inv.status!=='paid'&&<div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>ครบกำหนด: {inv.due_date||'-'}</div>}
              {inv.bank_account&&inv.status!=='paid'&&(
                <div style={{marginTop:10,background:'var(--gray)',borderRadius:8,padding:'10px 12px',fontSize:12}}>
                  <div style={{fontWeight:700,marginBottom:4}}>💳 ข้อมูลชำระเงิน</div>
                  <div>บัญชี: {inv.bank_account}</div>
                  {inv.qr_code_url&&<img src={inv.qr_code_url} alt="QR" style={{width:120,marginTop:8,borderRadius:6}}/>}
                </div>
              )}
            </div>
          ))}
          {!invoices.length&&<div style={{background:'var(--white)',borderRadius:12,padding:'20px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>ยังไม่มีใบแจ้งหนี้</div>}
        </div>
      </div>
    </div>
  )
}
