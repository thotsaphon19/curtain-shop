'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/',             label: 'Dashboard',     icon: '📊' },
  { href: '/jobs',         label: 'งาน',           icon: '🔧' },
  { href: '/customers',    label: 'ลูกค้า',        icon: '👤' },
  { href: '/technicians',  label: 'ช่าง',          icon: '👷' },
  { href: '/reports',      label: 'รายงาน',        icon: '📋' },
  { href: '/settings',     label: 'ตั้งค่า',       icon: '⚙️'  },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: '#0F6E56',
      display: 'flex', flexDirection: 'column', padding: '24px 0',
    }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>🪑 Admin</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>เฟอร์นิเจอร์</div>
      </div>
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {nav.map(item => {
          const active = path === item.href || (item.href !== '/' && path.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, marginBottom: 4,
              color: active ? '#fff' : 'rgba(255,255,255,0.75)',
              background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
              textDecoration: 'none', fontSize: 15, fontWeight: active ? 600 : 400,
              transition: 'all 0.15s',
            }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.15)',
        color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
        v1.0.0
      </div>
    </aside>
  )
}
