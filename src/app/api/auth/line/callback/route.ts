import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken, getRoleFromLineId, SessionUser } from '@/lib/session'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const stateRaw = searchParams.get('state') || ''

  // Derive appUrl from request host (same as auth route)
  const host = req.headers.get('host') || ''
  const proto = host.includes('localhost') ? 'http' : 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`

  if (!code) return NextResponse.redirect(`${appUrl}/login?error=no_code`)

  let requestedRole = 'customer'
  try {
    requestedRole = JSON.parse(Buffer.from(stateRaw, 'base64').toString()).role || 'customer'
  } catch { /**/ }

  // Exchange code for token - MUST use same redirect_uri as the auth request
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${appUrl}/api/auth/line/callback`,
      client_id: process.env.LINE_LOGIN_CLIENT_ID!,
      client_secret: process.env.LINE_LOGIN_CLIENT_SECRET!,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error('[LINE callback] token error:', errText)
    return NextResponse.redirect(`${appUrl}/login?error=token_fail`)
  }

  const { access_token } = await tokenRes.json()

  const profile = await (
    await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
  ).json()

  const lineUserId: string = profile.userId
  const adminRole = getRoleFromLineId(lineUserId)

  const { data: existing } = await supabaseAdmin
    .from('user_sessions').select('role,ref_id').eq('line_user_id', lineUserId).single()

  let finalRole: SessionUser['role'] = adminRole || (existing?.role as SessionUser['role'])

  if (!finalRole) {
    const { data: tech } = await supabaseAdmin
      .from('technicians').select('id').eq('line_user_id', lineUserId).single()
    if (tech) finalRole = 'technician'
    else {
      const { data: cust } = await supabaseAdmin
        .from('customers').select('id').eq('line_user_id', lineUserId).single()
      finalRole = cust ? 'customer' : (requestedRole as SessionUser['role'])
    }
  }

  await supabaseAdmin.from('user_sessions').upsert({
    line_user_id: lineUserId,
    display_name: profile.displayName,
    picture_url: profile.pictureUrl || '',
    role: finalRole,
    access_token,
  }, { onConflict: 'line_user_id' })

  const token = signToken({
    line_user_id: lineUserId,
    display_name: profile.displayName,
    picture_url: profile.pictureUrl,
    role: finalRole,
    ref_id: existing?.ref_id,
  })

  const dest = { admin: '/dashboard', technician: '/technician', customer: '/customer-portal' }[finalRole] || '/'
  const res = NextResponse.redirect(`${appUrl}${dest}`)
  res.cookies.set('session_token', token, {
    httpOnly: true, secure: true, sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, path: '/',
  })
  return res
}
