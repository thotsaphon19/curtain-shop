import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/session'

const PUBLIC = ['/login', '/join', '/api/auth', '/api/line', '/manifest.json', '/favicon.ico']
const ADMIN_PATHS = ['/dashboard', '/jobs', '/customers', '/technicians', '/reports',
  '/quotations', '/invoices', '/inventory', '/payments', '/settings',
  '/line-notify', '/map', '/queue', '/admin']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/_next')) return NextResponse.next()

  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  const user = verifyToken(token)
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  // Admin ถ้า role=admin (ทั้งจาก username/password และ LINE)
  const isAdmin = user.role === 'admin'

  if (pathname === '/') {
    if (isAdmin) return NextResponse.redirect(new URL('/dashboard', req.url))
    if (user.role === 'technician') return NextResponse.redirect(new URL('/technician', req.url))
    return NextResponse.redirect(new URL('/customer-portal', req.url))
  }

  if (ADMIN_PATHS.some(p => pathname.startsWith(p)) && !isAdmin) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
