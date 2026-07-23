import { NextRequest, NextResponse } from 'next/server'
import { getLineLoginCredentials } from '@/lib/line-login-config'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') || 'customer'
  const { clientId } = await getLineLoginCredentials()

  if (!clientId) {
    return NextResponse.redirect(
      new URL('/login?error=line_login_not_configured', req.url)
    )
  }

  // ใช้ header จาก request เพื่อหา host จริงๆ แทน env var
  const host = req.headers.get('host') || ''
  const proto = host.includes('localhost') ? 'http' : 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`

  const redirectUri = encodeURIComponent(`${appUrl}/api/auth/line/callback`)
  const state = Buffer.from(JSON.stringify({ role, ts: Date.now() })).toString('base64')
  const url =
    `https://access.line.me/oauth2/v2.1/authorize` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}` +
    `&scope=profile%20openid` +
    `&bot_prompt=aggressive`

  return NextResponse.redirect(url)
}
