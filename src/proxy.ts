import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/session'

const PUBLIC = ['/login','/join','/api/auth','/api/line','/manifest.json','/favicon.ico']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/_next')) return NextResponse.next()

  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  const user = verifyToken(token)
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const adminIds = (process.env.ADMIN_LINE_USER_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const isAdmin = adminIds.includes(user.line_user_id)

  if (pathname === '/') {
    if (isAdmin) return NextResponse.redirect(new URL('/dashboard', req.url))
    if (user.role === 'technician') return NextResponse.redirect(new URL('/technician', req.url))
    return NextResponse.redirect(new URL('/customer-portal', req.url))
  }

  const adminPaths = ['/dashboard','/jobs','/customers','/technicians','/reports',
    '/quotations','/invoices','/inventory','/payments','/settings',
    '/line-notify','/map','/queue','/admin']

  if (adminPaths.some(p => pathname.startsWith(p)) && !isAdmin) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
