import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'dev_secret'

export interface SessionUser {
  line_user_id: string
  display_name: string
  picture_url?: string
  role: 'admin' | 'technician' | 'customer'
  ref_id?: string
}

export function signToken(user: SessionUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '30d' })
}

export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) return null
  return verifyToken(token)
}

export function getRoleFromLineId(lineUserId: string): 'admin' | null {
  const adminIds = (process.env.ADMIN_LINE_USER_IDS || '').split(',').map(s => s.trim())
  return adminIds.includes(lineUserId) ? 'admin' : null
}
