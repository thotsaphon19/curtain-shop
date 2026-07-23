'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Customer, Technician } from '@/types'
import AddressMapPicker from '@/components/AddressMapPicker'

export default function NewJobPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [bankAccounts, setBankAccounts] = useState<{id:string;bank_name:string;account_name:string;account_number:string;branch?:string|null}[]>([])
  const [bankAccountChoice, setBankAccountChoice] = useState('') // id ที่เลือก หรือ '__custom__' สำหรับกรอกเอง
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ customer_id:'', technician_id:'', title:'', description:'', address:'', lat: null as number|null, lng: null as number|null, scheduled_date:'', scheduled_time:'', amount:'', deposit_amount:'', vat_amount:'', has_invoice_no:false, invoice_no:'', bank_account:'', priority:'3' })

  useEffect(() => {
    fetch('/api/customers').then(r=>r.json()).then(d=>setCustomers(d.data||[]))
    fetch('/api/technicians').then(r=>r.json()).then(d=>setTechnicians(d.data||[]))
    fetch('/api/settings/bank-accounts').then(r=>r.json()).then(d=>setBankAccounts(d.data||[]))
  },[])

  // เลือกบัญชีจาก dropdown → ประกอบเป็นข้อความเต็ม (ชื่อธนาคาร + ชื่อบัญชี + เลขบัญชี) เก็บลง form.bank_account
  // เพื่อให้ข้อความแจ้งเตือน/ใบแจ้งหนี้ที่ส่งลูกค้าโชว์ครบเหมือนบัตรบัญชีจริง
  function onBankAccountChoice(id: string) {
    setBankAccountChoice(id)
    if (id === '__custom__') { setForm(f => ({ ...f, bank_account: '' })); return }
    const acc = bankAccounts.find(a => a.id === id)
    if (!acc) { setForm(f => ({ ...f, bank_account: '' })); return }
    const text = `${acc.bank_name}\n${acc.account_name}\nเลขบัญชี ${acc.account_number}${acc.branch ? `\nสาขา${acc.branch}` : ''}`
    setForm(f => ({ ...f, bank_account: text }))
  }

  function onCustomerChange(id: string) {
    const c = customers.find(c=>c.id===id)
    setForm(f=>({...f, customer_id:id, address:c?.address||f.address, lat:c?.lat ?? f.lat, lng:c?.lng ?? f.lng}))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch('/api/jobs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
        ...form,
        amount: form.amount ? Number(form.amount) : null,
        deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : 0,
        vat_amount: form.vat_amount ? Number(form.vat_amount) : null,
        invoice_no: form.has_invoice_no ? form.invoice_no.trim() : null,
        priority: Number(form.priority),
      }) })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }

      // แจ้งเตือนถ้าส่ง LINE ไม่สำเร็จ ก่อนพาไปหน้ารายละเอียดงาน (เดิมเงียบสนิท ไม่รู้เลยว่าส่งไม่ถึง)
      const failed = (data.notify_results || []).filter((r: { success: boolean }) => !r.success)
      if (failed.length > 0) {
        const lines = failed.map((r: { recipient: string; reason?: string }) =>
          `${r.recipient === 'customer' ? 'ลูกค้า' : 'ช่าง'} — ${r.reason || 'ไม่ทราบสาเหตุ'}`)
        alert(`⚠️ สร้างงานสำเร็จ แต่ส่งแจ้งเตือน LINE ไม่สำเร็จบางส่วน:\n\n${lines.join('\n')}`)
      }

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
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.line_note ? ` 🏷️${c.line_note}` : ''} ({c.phone})</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <label className="label">ที่อยู่งาน <span style={{color:'var(--red)'}}>*</span></label>
              <AddressMapPicker
                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
                address={form.address}
                lat={form.lat}
                lng={form.lng}
                onChange={(v) => setForm(f=>({...f, ...v}))}
              />
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:6}}>
                💡 หลังบันทึกงาน ระบบจะใช้พิกัดนี้คำนวณระยะทาง/ลำดับงานอัตโนมัติที่หน้า{' '}
                <a href="/map" style={{color:'var(--brand)',fontWeight:600}}>🗺️ วางแผนเส้นทาง</a>
              </div>
            </div>
            <div className="form-grid" style={{marginBottom:12}}>
              <div>
                <label className="label">วันที่นัด <span style={{color:'var(--red)'}}>*</span></label>
                <input type="date" required value={form.scheduled_date} onChange={e=>setForm(f=>({...f,scheduled_date:e.target.value}))} className="input"/>
              </div>
              <div>
                <label className="label">เวลา (ไม่บังคับ)</label>
                <input type="time" value={form.scheduled_time} onChange={e=>setForm(f=>({...f,scheduled_time:e.target.value}))} className="input"/>
              </div>
            </div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:-6,marginBottom:12}}>
              💡 ไม่ต้องระบุเวลาก็ได้ — AI จะคำนวณลำดับงานจากระยะทางและความสำคัญให้อัตโนมัติที่หน้า
              {' '}<a href="/map" style={{color:'var(--brand)',fontWeight:600}}>🗺️ วางแผนเส้นทาง</a>
              {' '}แต่ถ้าลูกค้านัดเวลาไว้ ให้ใส่เวลาด้วย ระบบจะเอาไปคำนวณร่วมเป็นเงื่อนไข &quot;ต้องถึงก่อนเวลานี้&quot;
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
                <label className="label">ยอดทั้งหมด (บาท)</label>
                <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} className="input" placeholder="0"/>
              </div>
              <div>
                <label className="label">ยอดมัดจำ (บาท)</label>
                <input type="number" value={form.deposit_amount} onChange={e=>setForm(f=>({...f,deposit_amount:e.target.value}))} className="input" placeholder="0"/>
              </div>
              <div>
                <label className="label">ยอดคงเหลือ (คำนวณอัตโนมัติ)</label>
                <input type="text" readOnly value={
                  form.amount ? (Number(form.amount) + Number(form.vat_amount || 0) - Number(form.deposit_amount || 0)).toLocaleString() : '0'
                } className="input" style={{background:'var(--gray-lt)',color:'var(--text-muted)'}}/>
              </div>
              <div>
                <label className="label">VAT (บาท) — ใส่หรือไม่ใส่ก็ได้</label>
                <input type="number" value={form.vat_amount} onChange={e=>setForm(f=>({...f,vat_amount:e.target.value}))} className="input" placeholder="ไม่ระบุ"/>
              </div>
              <div>
                <label className="label">บัญชีธนาคาร</label>
                <select value={bankAccountChoice} onChange={e=>onBankAccountChoice(e.target.value)} className="select">
                  <option value="">-- เลือกบัญชี --</option>
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.bank_name} — {a.account_name} — {a.account_number}</option>
                  ))}
                  <option value="__custom__">อื่นๆ (กรอกเอง)</option>
                </select>
                {bankAccountChoice === '__custom__' && (
                  <textarea value={form.bank_account} onChange={e=>setForm(f=>({...f,bank_account:e.target.value}))} className="textarea" rows={3}
                    placeholder="ชื่อธนาคาร / ชื่อบัญชี / เลขบัญชี" style={{marginTop:8,resize:'vertical'}} />
                )}
              </div>
              <div>
                <label className="label" style={{display:'flex',alignItems:'center',gap:6}}>
                  <input type="checkbox" checked={form.has_invoice_no} onChange={e=>setForm(f=>({...f,has_invoice_no:e.target.checked, invoice_no: e.target.checked ? f.invoice_no : ''}))} />
                  มีเลขที่ Invoice
                </label>
                {form.has_invoice_no && (
                  <input value={form.invoice_no} onChange={e=>setForm(f=>({...f,invoice_no:e.target.value}))} className="input"
                    placeholder="เช่น INV2026001" autoFocus />
                )}
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
