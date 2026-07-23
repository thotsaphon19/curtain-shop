import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken, getRoleFromLineId, SessionUser } from '@/lib/session'
import { getLineLoginCredentials } from '@/lib/line-login-config'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const stateRaw = searchParams.get('state') || ''

  const host = req.headers.get('host') || ''
  const proto = host.includes('localhost') ? 'http' : 'https'
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`).replace(/\/$/, '')

  if (!code) return NextResponse.redirect(`${appUrl}/login?error=no_code`)

  // role ที่กดมาจากหน้า login (technician / customer)
  let requestedRole: SessionUser['role'] = 'customer'
  try {
    requestedRole = JSON.parse(Buffer.from(stateRaw, 'base64').toString()).role || 'customer'
  } catch { /**/ }

  // Exchange code → access_token
  const { clientId, clientSecret } = await getLineLoginCredentials()
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${appUrl}/api/auth/line/callback`,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!tokenRes.ok) {
    console.error('[LINE callback] token error:', await tokenRes.text())
    return NextResponse.redirect(`${appUrl}/login?error=token_fail`)
  }

  const { access_token } = await tokenRes.json()
  const profile = await (
    await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
  ).json()

  const lineUserId: string = profile.userId

  // ── ตรวจสอบสิทธิ์ตามลำดับ Priority ──────────────────────────────────────
  // 1. ADMIN_LINE_USER_IDS env var (สูงสุด — override ทุกอย่าง)
  const adminRole = getRoleFromLineId(lineUserId)
  if (adminRole) {
    return issueToken(appUrl, profile, access_token, 'admin', null)
  }

  // 2. app_users table — Admin กำหนดสิทธิ์ไว้แล้ว (เชื่อถือได้สูงสุดรองจาก env)
  const { data: appUser } = await supabaseAdmin
    .from('app_users')
    .select('role, status, ref_id, id')
    .eq('line_user_id', lineUserId)
    .eq('status', 'active')
    .maybeSingle()

  if (appUser) {
    // sync role กลับไป user_sessions ด้วย
    await supabaseAdmin.from('user_sessions').upsert({
      line_user_id: lineUserId,
      display_name: profile.displayName,
      picture_url: profile.pictureUrl || '',
      role: appUser.role,
      access_token,
    }, { onConflict: 'line_user_id' })

    return issueToken(appUrl, profile, access_token, appUser.role as SessionUser['role'], appUser.ref_id)
  }

  // 3. technicians / customers table — ผูก LINE ไว้โดยตรง
  const { data: tech } = await supabaseAdmin
    .from('technicians').select('id').eq('line_user_id', lineUserId).eq('status', 'active').maybeSingle()
  if (tech) {
    await upsertSession(lineUserId, profile, access_token, 'technician')
    return issueToken(appUrl, profile, access_token, 'technician', tech.id)
  }

  const { data: cust } = await supabaseAdmin
    .from('customers').select('id').eq('line_user_id', lineUserId).maybeSingle()
  if (cust) {
    await upsertSession(lineUserId, profile, access_token, 'customer')
    return issueToken(appUrl, profile, access_token, 'customer', cust.id)
  }

  // 4. user_sessions — เคย login มาก่อน มี role บันทึกไว้
  const { data: sess } = await supabaseAdmin
    .from('user_sessions').select('role, ref_id').eq('line_user_id', lineUserId).maybeSingle()
  if (sess?.role && sess.role !== 'customer') {
    await upsertSession(lineUserId, profile, access_token, sess.role as SessionUser['role'])
    return issueToken(appUrl, profile, access_token, sess.role as SessionUser['role'], sess.ref_id)
  }

  // 5. สร้าง record อัตโนมัติตาม role ที่กดมาจากหน้า Login
  //    ช่าง → สร้างใน technicians ทันที
  //    ลูกค้า → สร้างใน customers ทันที
  //    ไม่ต้องรอ Admin กำหนดสิทธิ์
  if (requestedRole === 'technician') {
    const { data: newTech } = await supabaseAdmin
      .from('technicians')
      .insert({ name: profile.displayName, phone: '', line_user_id: lineUserId, status: 'active' })
      .select().single()
    await upsertSession(lineUserId, profile, access_token, 'technician')
    return issueToken(appUrl, profile, access_token, 'technician', newTech?.id || null)
  }

  if (requestedRole === 'customer') {
    const { data: newCust } = await supabaseAdmin
      .from('customers')
      .insert({ name: profile.displayName, phone: '', address: '-', line_user_id: lineUserId })
      .select().single()
    await upsertSession(lineUserId, profile, access_token, 'customer')
    return issueToken(appUrl, profile, access_token, 'customer', newCust?.id || null)
  }

  // fallback
  await upsertSession(lineUserId, profile, access_token, requestedRole)
  return issueToken(appUrl, profile, access_token, requestedRole, null)
}

// ── helpers ──────────────────────────────────────────────────────────────────
async function upsertSession(
  lineUserId: string, profile: { displayName: string; pictureUrl?: string },
  accessToken: string, role: SessionUser['role']
) {
  await supabaseAdmin.from('user_sessions').upsert({
    line_user_id: lineUserId,
    display_name: profile.displayName,
    picture_url: profile.pictureUrl || '',
    role,
    access_token: accessToken,
  }, { onConflict: 'line_user_id' })
}

function issueToken(
  appUrl: string,
  profile: { userId: string; displayName: string; pictureUrl?: string },
  _accessToken: string,
  role: SessionUser['role'],
  refId: string | null
) {
  const token = signToken({
    line_user_id: profile.userId,
    display_name: profile.displayName,
    picture_url: profile.pictureUrl,
    role,
    ref_id: refId || undefined,
  })

  const dest: Record<string, string> = {
    admin: '/dashboard',
    technician: '/technician',
    customer: '/customer-portal',
    viewer: '/dashboard',
  }

  const res = NextResponse.redirect(`${appUrl}${dest[role] || '/'}`)
  res.cookies.set('session_token', token, {
    httpOnly: true, secure: true, sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, path: '/',
  })
  return res
}
