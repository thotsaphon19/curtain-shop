import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') || 'customer'
  const clientId = process.env.LINE_LOGIN_CLIENT_ID!
  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/line/callback`)
  const state = Buffer.from(JSON.stringify({ role, ts: Date.now() })).toString('base64')
  const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid&bot_prompt=aggressive`
  return NextResponse.redirect(url)
}
