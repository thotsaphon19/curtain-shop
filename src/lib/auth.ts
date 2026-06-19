import { NextRequest } from 'next/server'

export function checkAdminAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')
  return token === process.env.NEXTAUTH_SECRET
}

export function checkCronAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret')
  return secret === process.env.CRON_SECRET
}
