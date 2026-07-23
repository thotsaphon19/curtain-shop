import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '@/lib/session'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const validUsername = process.env.ADMIN_USERNAME || 'admin'
  const validPassword = process.env.ADMIN_PASSWORD || 'admin1234'

  if (username !== validUsername || password !== validPassword) {
    return NextResponse.json({ error: 'Username หรือ Password ไม่ถูกต้อง' }, { status: 401 })
  }

  // สร้าง session token สำหรับ admin
  const token = signToken({
    line_user_id: `admin_${username}`,
    display_name: 'Admin',
    role: 'admin',
  })

  const res = NextResponse.json({ success: true })
  res.cookies.set('session_token', token, {
    httpOnly: true, secure: true, sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, path: '/',
  })
  return res
}
