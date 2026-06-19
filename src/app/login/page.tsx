export const dynamic = 'force-dynamic'

export default function LoginPage({ searchParams }: { searchParams: Record<string,string> }) {
  const error = searchParams?.error
  const errorMsg: Record<string,string> = { no_code:'ไม่ได้รับรหัสจาก Line', token_fail:'ไม่สามารถเชื่อมต่อ Line ได้' }
  const cards = [
    { role:'admin', icon:'👑', label:'เจ้าของร้าน / Admin', desc:'จัดการระบบทั้งหมด', color:'#0F6E56', bg:'#E1F5EE' },
    { role:'technician', icon:'👷', label:'ช่างติดตั้ง', desc:'รับงาน ปิดงาน', color:'#854F0B', bg:'#FAEEDA' },
    { role:'customer', icon:'🏠', label:'ลูกค้า', desc:'ติดตามงาน ชำระเงิน', color:'#185FA5', bg:'#E6F1FB' },
  ]
  return (
    <html lang="th"><body style={{ margin:0, fontFamily:'system-ui,sans-serif' }}>
    <div style={{ minHeight:'100dvh', background:'linear-gradient(135deg,#0F6E56 0%,#185FA5 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <div style={{ fontSize:60, marginBottom:8 }}>🪟</div>
        <h1 style={{ color:'#fff', fontSize:28, fontWeight:800, margin:0 }}>ร้านผ้าม่าน</h1>
        <p style={{ color:'rgba(255,255,255,0.75)', fontSize:15, margin:'6px 0 0' }}>ระบบบริหารจัดการครบวงจร</p>
      </div>
      {error && (
        <div style={{ background:'rgba(255,80,80,0.15)', border:'1px solid rgba(255,80,80,0.4)', borderRadius:10, padding:'10px 18px', color:'#fff', fontSize:14, marginBottom:20 }}>
          {errorMsg[error] || 'เกิดข้อผิดพลาด'}
        </div>
      )}
      <div style={{ display:'grid', gap:14, gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', width:'100%', maxWidth:620 }}>
        {cards.map(c => (
          <a key={c.role} href={`/api/auth/line?role=${c.role}`} style={{ textDecoration:'none' }}>
            <div style={{ background:'#fff', borderRadius:16, padding:'24px 16px', textAlign:'center', boxShadow:'0 4px 24px rgba(0,0,0,0.12)' }}>
              <div style={{ width:52, height:52, borderRadius:14, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, margin:'0 auto 10px' }}>{c.icon}</div>
              <div style={{ fontWeight:700, fontSize:15, color:'#1A1A1A', marginBottom:3 }}>{c.label}</div>
              <div style={{ fontSize:12, color:'#888', marginBottom:14 }}>{c.desc}</div>
              <div style={{ background:'#06C755', borderRadius:10, padding:'10px 0', color:'#fff', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <span style={{ fontSize:16 }}>💬</span> เข้าด้วย LINE
              </div>
            </div>
          </a>
        ))}
      </div>
      <p style={{ color:'rgba(255,255,255,0.45)', fontSize:11, marginTop:24, textAlign:'center' }}>ระบบปลอดภัย · เข้าสู่ระบบด้วยบัญชี LINE เท่านั้น</p>
    </div>
    </body></html>
  )
}
