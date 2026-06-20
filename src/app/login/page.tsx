import AdminLoginForm from './AdminLoginForm'
export const dynamic = 'force-dynamic'

export default function LoginPage({ searchParams }: { searchParams: Record<string, string> }) {
  const error = searchParams?.error
  const next = searchParams?.next || ''

  return (
    <html lang="th"><body style={{ margin:0, fontFamily:'system-ui,sans-serif' }}>
    <div style={{ minHeight:'100dvh', background:'linear-gradient(135deg,#0F6E56 0%,#185FA5 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <div style={{ fontSize:60, marginBottom:8 }}>🪟</div>
        <h1 style={{ color:'#fff', fontSize:28, fontWeight:800, margin:0 }}>ร้านผ้าม่าน</h1>
        <p style={{ color:'rgba(255,255,255,0.75)', fontSize:15, margin:'6px 0 0' }}>ระบบบริหารจัดการครบวงจร</p>
      </div>

      {/* Admin login */}
      <div style={{ background:'#fff', borderRadius:16, padding:'28px 24px', width:'100%', maxWidth:360, boxShadow:'0 4px 24px rgba(0,0,0,0.15)', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:'var(--purple-lt,#EEEDFE)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>👑</div>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:'#1A1A1A' }}>เจ้าของร้าน / Admin</div>
            <div style={{ fontSize:12, color:'#888' }}>เข้าด้วย Username & Password</div>
          </div>
        </div>
        <AdminLoginForm error={error} next={next} />
      </div>

      {/* ช่าง + ลูกค้า ยัง login ด้วย LINE */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, width:'100%', maxWidth:360 }}>
        {[
          { role:'technician', icon:'👷', label:'ช่างติดตั้ง', desc:'รับงาน ปิดงาน', color:'#854F0B', bg:'#FAEEDA' },
          { role:'customer',   icon:'🏠', label:'ลูกค้า',      desc:'ติดตามงาน จ่ายเงิน', color:'#185FA5', bg:'#E6F1FB' },
        ].map(c => (
          <a key={c.role} href={`/api/auth/line?role=${c.role}`} style={{ textDecoration:'none' }}>
            <div style={{ background:'#fff', borderRadius:14, padding:'16px 12px', textAlign:'center', boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}>
              <div style={{ width:44, height:44, borderRadius:12, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, margin:'0 auto 8px' }}>{c.icon}</div>
              <div style={{ fontWeight:700, fontSize:13, color:'#1A1A1A', marginBottom:2 }}>{c.label}</div>
              <div style={{ fontSize:11, color:'#888', marginBottom:10 }}>{c.desc}</div>
              <div style={{ background:'#06C755', borderRadius:8, padding:'7px 0', color:'#fff', fontWeight:700, fontSize:12 }}>💬 LINE</div>
            </div>
          </a>
        ))}
      </div>

      <p style={{ color:'rgba(255,255,255,0.45)', fontSize:11, marginTop:20, textAlign:'center' }}>
        ระบบปลอดภัย · ร้านผ้าม่าน
      </p>
    </div>
    </body></html>
  )
}
