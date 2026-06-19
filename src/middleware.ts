import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/session'

const PUBLIC_PATHS = [
  '/login', '/join',
  '/api/auth', '/api/line',
  '/manifest.json', '/favicon.ico',
  '/_next', '/icons', '/images',
]

const ADMIN_PATHS = [
  '/dashboard','/jobs','/customers','/technicians','/reports',
  '/quotations','/invoices','/inventory','/payments','/settings',
  '/line-notify','/map','/queue','/admin',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname === '/') {
    const token = req.cookies.get('session_token')?.value
    if (!token) return NextResponse.redirect(new URL('/login', req.url))
    const user = verifyToken(token)
    if (!user) return NextResponse.redirect(new URL('/login', req.url))
    const dest = { admin:'/dashboard', technician:'/technician', customer:'/customer-portal' }[user.role] || '/login'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  const token = req.cookies.get('session_token')?.value
  if (!token) {
    const url = new URL('/login', req.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const user = verifyToken(token)
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  // Role guard
  const isAdminPath = ADMIN_PATHS.some(p => pathname.startsWith(p))
  if (isAdminPath && user.role !== 'admin') {
    const dest = { technician:'/technician', customer:'/customer-portal' }[user.role] || '/login'
    return NextResponse.redirect(new URL(dest, req.url))
  }
  if (pathname.startsWith('/technician') && user.role !== 'technician' && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (pathname.startsWith('/customer-portal') && user.role !== 'customer') {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|images).*)'],
}
