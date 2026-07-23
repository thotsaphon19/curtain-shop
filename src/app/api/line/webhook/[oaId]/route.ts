import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { processWebhookEvents, type LineEvent } from '@/lib/line-webhook-handler'
export const dynamic = 'force-dynamic'

// เว็บฮุคสำหรับบัญชี OA ที่ไม่ใช่ default — ตั้ง Webhook URL ใน LINE Developers Console
// ของ Channel นั้นๆ เป็น https://โดเมนเว็บ/api/line/webhook/<id ของบัญชีนี้ในหน้า Settings>
export async function POST(req: NextRequest, { params }: { params: Promise<{ oaId: string }> }) {
  const { oaId } = await params

  const { data: account } = await supabaseAdmin
    .from('line_oa_accounts').select('id, channel_secret').eq('id', oaId).eq('active', true).maybeSingle()
  if (!account) return NextResponse.json({ error: 'ไม่พบบัญชี OA นี้ หรือถูกปิดใช้งานอยู่' }, { status: 404 })

  const rawBody = await req.text()
  const sig = req.headers.get('x-line-signature') || ''
  const hash = crypto.createHmac('SHA256', account.channel_secret).update(rawBody).digest('base64')
  if (hash !== sig) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  const body = JSON.parse(rawBody)
  const events: LineEvent[] = body.events || []
  await processWebhookEvents(events, account.id)

  return NextResponse.json({ status: 'ok' })
}
