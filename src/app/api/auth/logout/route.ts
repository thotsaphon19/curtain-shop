import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function GET() {
  const res = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)
  res.cookies.delete('session_token')
  return res
}
