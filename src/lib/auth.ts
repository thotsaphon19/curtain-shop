import { NextRequest } from 'next/server'

export function checkAdminAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')
  return token === process.env.NEXTAUTH_SECRET
}

export function checkCronAuth(req: NextRequest): boolean {
  if (!process.env.CRON_SECRET) return false
  // Vercel Cron Jobs เรียกด้วย header "Authorization: Bearer <CRON_SECRET>" โดยอัตโนมัติ
  // (ไม่สามารถกำหนด header เองใน vercel.json ได้) — เช็คแบบนี้เป็นหลัก
  const auth = req.headers.get('authorization') || ''
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true
  // เผื่อไว้สำหรับเรียกทดสอบเองด้วย x-cron-secret header
  const legacy = req.headers.get('x-cron-secret')
  return legacy === process.env.CRON_SECRET
}
