import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/join', '/api/auth', '/api/line', '/manifest.json', '/favicon.ico']
const ADMIN_PATHS = ['/dashboard','/jobs','/customers','/technicians','/reports','/quotations','/invoices','/inventory','/payments','/settings','/line-notify','/map','/queue','/admin']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/_next')) return NextResponse.next()

  const token = req.cookies.get('session_token')?.value
  if (!token) {
    const url = new URL('/login', req.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const user = verifyToken(token)
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const adminIds = (process.env.ADMIN_LINE_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
  const isAdmin = adminIds.includes(user.line_user_id)
  const effectiveRole = isAdmin ? 'admin' : user.role

  if (pathname === '/') {
    const dest = { admin: '/dashboard', technician: '/technician', customer: '/customer-portal' }[effectiveRole] || '/login'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  const isAdminPath = ADMIN_PATHS.some(p => pathname.startsWith(p))
  if (isAdminPath && !isAdmin && effectiveRole !== 'admin') {
    const dest = { technician: '/technician', customer: '/customer-portal' }[effectiveRole] || '/login'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|images).*)'],
}
