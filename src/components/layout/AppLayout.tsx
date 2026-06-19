'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem { href: string; label: string; icon: string; badge?: string }

const ADMIN_NAV: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',      icon: '📊' },
  { href: '/queue',       label: 'จัดคิวงาน',      icon: '📅' },
  { href: '/map',         label: 'แผนที่',          icon: '🗺️' },
  { href: '/jobs',        label: 'งาน',            icon: '🔧' },
  { href: '/quotations',  label: 'ใบเสนอราคา',     icon: '📋' },
  { href: '/invoices',    label: 'Invoice',        icon: '💳' },
  { href: '/payments',    label: 'ชำระเงิน',       icon: '💰' },
  { href: '/line-notify', label: 'LINE แจ้งเตือน', icon: '📣' },
  { href: '/customers',   label: 'ลูกค้า',         icon: '👤' },
  { href: '/technicians', label: 'ช่าง',           icon: '👷' },
  { href: '/inventory',   label: 'คลังสินค้า',     icon: '🪟' },
  { href: '/reports',     label: 'รายงาน',         icon: '📈' },
  { href: '/admin/users', label: 'จัดการ User',    icon: '👥' },
  { href: '/settings',    label: 'ตั้งค่า',        icon: '⚙️' },
]

const BOTTOM_NAV: NavItem[] = [
  { href: '/dashboard', label: 'หลัก',   icon: '📊' },
  { href: '/queue',     label: 'คิวงาน', icon: '📅' },
  { href: '/jobs',      label: 'งาน',    icon: '🔧' },
  { href: '/invoices',  label: 'Invoice',icon: '💳' },
  { href: '/line-notify',label: 'แจ้ง',  icon: '📣' },
]

interface User { display_name: string; picture_url?: string; role: string }
interface Props { children: React.ReactNode; user: User | null }

export default function AppLayout({ children, user }: Props) {
  const path = usePathname()
  const [sideOpen, setSideOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setSideOpen(false) }, [path])

  const isActive = (href: string) => href === '/dashboard' ? path === href : path.startsWith(href)

  const SidebarContent = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'16px 14px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:24 }}>🪟</span>
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:14, lineHeight:1.2 }}>ร้านผ้าม่าน</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10 }}>ระบบบริหารจัดการ</div>
          </div>
        </div>
      </div>
      {user && (
        <div style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {user.picture_url
            ? <img src={user.picture_url} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
            : <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>😊</div>
          }
          <div style={{ minWidth:0 }}>
            <div style={{ color:'#fff', fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.display_name}</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10 }}>{{ admin:'Admin', technician:'ช่าง', customer:'ลูกค้า' }[user.role] || user.role}</div>
          </div>
        </div>
      )}
      <nav style={{ flex:1, padding:'6px 8px', overflowY:'auto' }}>
        {ADMIN_NAV.map(item => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href} style={{
              display:'flex', alignItems:'center', gap:8, padding:'7px 9px',
              borderRadius:8, marginBottom:1, textDecoration:'none',
              color: active ? '#fff' : 'rgba(255,255,255,0.6)',
              background: active ? 'var(--brand)' : 'transparent',
              fontSize:13, fontWeight: active ? 700 : 400, transition:'all 0.1s',
            }}>
              <span style={{ fontSize:14, minWidth:18, textAlign:'center' }}>{item.icon}</span>
              <span style={{ flex:1 }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div style={{ padding:'8px 8px', borderTop:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <a href="/api/auth/logout" style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 9px', borderRadius:8, color:'rgba(255,255,255,0.4)', fontSize:12 }}>
          <span>🚪</span> ออกจากระบบ
        </a>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', height:'100dvh', overflow:'hidden', background:'var(--gray)' }}>
      {!isMobile && (
        <aside style={{ width:'var(--sidebar-w)', minWidth:'var(--sidebar-w)', background:'var(--dark)', flexShrink:0 }}>
          <SidebarContent/>
        </aside>
      )}
      {isMobile && sideOpen && (
        <>
          <div onClick={() => setSideOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:40 }}/>
          <aside style={{ position:'fixed', left:0, top:0, bottom:0, width:240, background:'var(--dark)', zIndex:50, overflowY:'auto' }}>
            <SidebarContent/>
          </aside>
        </>
      )}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {isMobile && (
          <header style={{ background:'var(--dark)', padding:'0 14px', height:'var(--topbar-h)', display:'flex', alignItems:'center', gap:12, flexShrink:0, zIndex:10 }}>
            <button onClick={() => setSideOpen(true)} style={{ background:'none', border:'none', color:'#fff', fontSize:22, padding:4, display:'flex', alignItems:'center' }}>☰</button>
            <span style={{ color:'#fff', fontWeight:800, fontSize:15, flex:1 }}>🪟 ร้านผ้าม่าน</span>
            {user?.picture_url && <img src={user.picture_url} alt="" style={{ width:28, height:28, borderRadius:'50%' }}/>}
          </header>
        )}
        <main style={{ flex:1, overflowY:'auto', padding:'var(--content-p)', paddingBottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom, 12px))' : 'var(--content-p)' }}>
          {children}
        </main>
      </div>
      {isMobile && (
        <nav className="bottom-nav">
          {BOTTOM_NAV.map(item => {
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href} className={`bottom-nav-item ${active ? 'active' : ''}`}>
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
          <button onClick={() => setSideOpen(true)} className="bottom-nav-item">
            <span className="nav-icon">⋯</span>
            <span>เพิ่มเติม</span>
          </button>
        </nav>
      )}
    </div>
  )
}
