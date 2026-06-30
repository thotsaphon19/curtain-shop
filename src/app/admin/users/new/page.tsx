'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserRole } from '@/types'

export default function NewUserPage() {
  const router = useRouter()
  const [form, setForm] = useState({ display_name:'', phone:'', email:'', role:'customer' as UserRole, notes:'', line_user_id:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const res = await fetch('/api/admin/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false); return }
    router.push('/admin/users')
  }

  const ROLES: [UserRole, string, string][] = [
    ['admin','👑 Admin','สิทธิ์เต็มทุกอย่าง'],
    ['technician','👷 ช่าง','รับงาน ปิดงาน ถ่ายรูป'],
    ['customer','👤 ลูกค้า','ดูงาน ชำระเงิน'],
    ['viewer','👁 Viewer','ดูอย่างเดียว'],
  ]

  return (
    <div style={{ minHeight:'100dvh', background:'var(--gray)' }}>
      <header style={{ background:'var(--dark)', padding:'0 16px', height:'var(--topbar-h)', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10 }}>
        <a href="/admin/users" style={{ color:'rgba(255,255,255,0.6)', fontSize:20 }}>←</a>
        <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>เพิ่มผู้ใช้ใหม่</span>
      </header>
      <div style={{ maxWidth:560, margin:'0 auto', padding:'var(--content-p)', paddingBottom:40 }}>
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="card" style={{ padding:18 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--dark)', marginBottom:14 }}>ข้อมูลผู้ใช้</div>
            <div style={{ marginBottom:12 }}>
              <label className="label">ชื่อ <span style={{ color:'var(--red)' }}>*</span></label>
              <input required value={form.display_name} onChange={e=>setForm(f=>({...f,display_name:e.target.value}))} className="input" placeholder="ชื่อ-นามสกุล"/>
            </div>
            <div className="form-grid" style={{ marginBottom:12 }}>
              <div>
                <label className="label">โทรศัพท์</label>
                <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="input" placeholder="08x-xxx-xxxx"/>
              </div>
              <div>
                <label className="label">อีเมล</label>
                <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="input" placeholder="email@example.com"/>
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label className="label">LINE User ID (ถ้ามี)</label>
              <input value={form.line_user_id} onChange={e=>setForm(f=>({...f,line_user_id:e.target.value}))} className="input" placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"/>
              <div className="text-xs text-muted" style={{ marginTop:4 }}>หาได้จาก Webhook log เมื่อผู้ใช้ Follow LINE OA</div>
            </div>
            <div>
              <label className="label">หมายเหตุ</label>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className="input" placeholder="ข้อมูลเพิ่มเติม"/>
            </div>
          </div>

          <div className="card" style={{ padding:18 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--purple)', marginBottom:12 }}>Role & สิทธิ์</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {ROLES.map(([r, label, desc]) => (
                <label key={r} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px', borderRadius:10, border:`2px solid ${form.role===r?'var(--brand)':'var(--border)'}`, background:form.role===r?'var(--brand-lt)':'var(--white)', cursor:'pointer' }}>
                  <input type="radio" name="role" value={r} checked={form.role===r} onChange={()=>setForm(f=>({...f,role:r}))} style={{ marginTop:2, accentColor:'var(--brand)' }}/>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13, color:form.role===r?'var(--brand)':'var(--dark)' }}>{label}</div>
                    <div className="text-xs text-muted">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding:'13px', justifyContent:'center', fontSize:15 }}>
            {loading ? 'กำลังสร้าง...' : '✅ สร้างผู้ใช้'}
          </button>
        </form>
      </div>
    </div>
  )
}
