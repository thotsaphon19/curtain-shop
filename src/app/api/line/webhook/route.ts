import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getLineOACredentials } from '@/lib/line-config'
import { processWebhookEvents, type LineEvent } from '@/lib/line-webhook-handler'
export const dynamic = 'force-dynamic'

// เว็บฮุคของบัญชี default — URL นี้ใช้เหมือนเดิม ไม่ต้องเปลี่ยนอะไรใน LINE Developers Console
// (บัญชี OA อื่นๆ ที่เพิ่มภายหลัง ใช้ URL แยกที่ /api/line/webhook/[oaId] แทน)
async function verifySignature(body: string, sig: string): Promise<boolean> {
  const { secret } = await getLineOACredentials()
  const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64')
  return hash === sig
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('x-line-signature') || ''
  if (!(await verifySignature(rawBody, sig)))
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  const body = JSON.parse(rawBody)
  const events: LineEvent[] = body.events || []
  await processWebhookEvents(events, undefined)

  return NextResponse.json({ status: 'ok' })
}
