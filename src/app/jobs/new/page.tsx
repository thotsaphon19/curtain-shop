'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Customer, Technician } from '@/types'

export default function NewJobPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ customer_id:'', technician_id:'', title:'', description:'', address:'', scheduled_date:'', scheduled_time:'', amount:'', bank_account:'', priority:'3' })

  useEffect(() => {
    fetch('/api/customers').then(r=>r.json()).then(d=>setCustomers(d.data||[]))
    fetch('/api/technicians').then(r=>r.json()).then(d=>setTechnicians(d.data||[]))
  },[])

  function onCustomerChange(id: string) {
    const c = customers.find(c=>c.id===id)
    setForm(f=>({...f, customer_id:id, address:c?.address||f.address}))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch('/api/jobs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...form, amount:form.amount?Number(form.amount):null, priority:Number(form.priority)}) })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      router.push(`/jobs/${data.data.id}`)
    } catch { setError('เกิดข้อผิดพลาด'); setLoading(false) }
  }

  return (
    <div style={{minHeight:'100dvh',background:'var(--gray)'}}>
      <header style={{background:'var(--dark)',padding:'0 16px',height:'var(--topbar-h)',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
        <a href="/jobs" style={{color:'rgba(255,255,255,0.6)',fontSize:20}}>←</a>
        <span style={{color:'#fff',fontWeight:700,fontSize:15}}>สร้างงานใหม่</span>
      </header>

      <div style={{maxWidth:640,margin:'0 auto',padding:'var(--content-p)',paddingBottom:40}}>
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:14}}>

          <div className="card" style={{padding:18}}>
            <div style={{fontWeight:700,fontSize:14,color:'var(--brand)',marginBottom:14}}>ข้อมูลงาน</div>
            <div style={{marginBottom:12}}>
              <label className="label">ชื่องาน <span style={{color:'var(--red)'}}>*</span></label>
              <input required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="input" placeholder="เช่น ติดตั้งผ้าม่านห้องนอน"/>
            </div>
            <div style={{marginBottom:12}}>
              <label className="label">ลูกค้า <span style={{color:'var(--red)'}}>*</span></label>
              <select required value={form.customer_id} onChange={e=>onCustomerChange(e.target.value)} className="select">
                <option value="">-- เลือกลูกค้า --</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <label className="label">ที่อยู่งาน <span style={{color:'var(--red)'}}>*</span></label>
              <input required value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} className="input" placeholder="ที่อยู่สำหรับช่าง"/>
            </div>
            <div className="form-grid" style={{marginBottom:12}}>
              <div>
                <label className="label">วันที่นัด <span style={{color:'var(--red)'}}>*</span></label>
                <input type="date" required value={form.scheduled_date} onChange={e=>setForm(f=>({...f,scheduled_date:e.target.value}))} className="input"/>
              </div>
              <div>
                <label className="label">เวลา <span style={{color:'var(--red)'}}>*</span></label>
                <input type="time" required value={form.scheduled_time} onChange={e=>setForm(f=>({...f,scheduled_time:e.target.value}))} className="input"/>
              </div>
            </div>
            <div>
              <label className="label">รายละเอียด</label>
              <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="textarea" rows={2} style={{resize:'vertical'}}/>
            </div>
          </div>

          <div className="card" style={{padding:18}}>
            <div style={{fontWeight:700,fontSize:14,color:'var(--purple)',marginBottom:14}}>ช่าง & ค่าบริการ</div>
            <div style={{marginBottom:12}}>
              <label className="label">ช่าง</label>
              <select value={form.technician_id} onChange={e=>setForm(f=>({...f,technician_id:e.target.value}))} className="select">
                <option value="">-- เลือกช่าง --</option>
                {technicians.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <label className="label">ความสำคัญ</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {[['1','🔴 ด่วนมาก'],['2','🟠 ด่วน'],['3','🟡 ปกติ'],['4','🟢 ยืดหยุ่น']].map(([v,l])=>(
                  <button key={v} type="button" onClick={()=>setForm(f=>({...f,priority:v}))} style={{padding:'6px 12px',borderRadius:8,border:`2px solid ${form.priority===v?'var(--brand)':'var(--border)'}`,background:form.priority===v?'var(--brand-lt)':'var(--white)',fontSize:12,fontWeight:600,color:form.priority===v?'var(--brand)':'var(--text-muted)',cursor:'pointer'}}>{l}</button>
                ))}
              </div>
            </div>
            <div className="form-grid">
              <div>
                <label className="label">ยอดเรียกเก็บ (บาท)</label>
                <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} className="input" placeholder="0"/>
              </div>
              <div>
                <label className="label">เลขบัญชีธนาคาร</label>
                <input value={form.bank_account} onChange={e=>setForm(f=>({...f,bank_account:e.target.value}))} className="input" placeholder="xxx-x-xxxxx-x"/>
              </div>
            </div>
          </div>

          {error&&<div className="alert alert-error">{error}</div>}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{padding:'13px',justifyContent:'center',fontSize:15}}>
            {loading?'กำลังสร้าง...':'✅ สร้างงาน + แจ้งเตือน Line OA'}
          </button>
        </form>
      </div>
    </div>
  )
}
