import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyDailySchedule, notifyOverdue, sendInvoiceToGroup, sendGroupMessage } from '@/lib/line'
import { checkCronAuth } from '@/lib/auth'
import { getBangkokDateString } from '@/lib/date'
import { getLineOACredentials } from '@/lib/line-config'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return runDailyCron(req)
}

// Vercel Cron Jobs เรียก endpoint ด้วย GET เสมอ (ตั้งไว้ที่ vercel.json → 0 1 * * * UTC = 08:00 น. เวลาไทย)
//
// หมายเหตุสำคัญ: Vercel แผน Hobby (ฟรี) จำกัด cron job ให้รันได้ "แค่วันละครั้งตายตัว" เท่านั้น
// ตั้งให้เช็คทุก 15 นาทีเพื่อรองรับเวลาที่ตั้งเองจาก Settings แบบ dynamic ไม่ได้ (ต้องแผน Pro)
// เพราะฉะนั้นค่า "เวลาแจ้งเตือน" ที่ตั้งในหน้า Settings จะเป็นแค่ข้อมูลอ้างอิง/บันทึกไว้เท่านั้น
// เวลาจริงที่ระบบส่งคือ 08:00 น. ตายตัวตามที่ตั้งไว้ในไฟล์นี้ (vercel.json) — ถ้าต้องการเปลี่ยนเวลาจริง
// ต้องแก้ค่า schedule ในไฟล์ vercel.json แล้ว deploy ใหม่ (ไม่มีทางเลี่ยงบนแผนฟรี)
export async function GET(req: NextRequest) {
  return runDailyCron(req)
}

async function runDailyCron(req: NextRequest) {
  if (!checkCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = getBangkokDateString()

  // กันรันซ้ำในวันเดียวกัน เผื่อมีคนกด trigger cron ซ้ำด้วยมือ หรือ Vercel retry
  const { data: lastSentRow } = await supabaseAdmin
    .from('app_settings').select('value').eq('key', 'daily_notification_last_sent').maybeSingle()
  if (lastSentRow?.value === today) {
    return NextResponse.json({ skipped: true, reason: 'ส่งไปแล้ววันนี้', date: today })
  }
  await supabaseAdmin.from('app_settings').upsert({ key: 'daily_notification_last_sent', value: today, updated_at: new Date().toISOString() })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const results: string[] = []

  // ── 1. ส่งตารางงานประจำวัน → ช่างแต่ละคน ────────────────────────────────
  const { data: todayJobs } = await supabaseAdmin
    .from('jobs')
    .select('*, technician:technicians(*), customer:customers(*)')
    .eq('scheduled_date', today)
    .in('status', ['assigned', 'heading', 'in_progress'])
    .order('scheduled_time')

  if (todayJobs) {
    const byTech = new Map<string, typeof todayJobs>()
    for (const job of todayJobs) {
      if (!job.technician_id) continue
      const arr = byTech.get(job.technician_id) || []
      arr.push(job); byTech.set(job.technician_id, arr)
    }
    for (const [, jobs] of byTech) {
      const tech = jobs[0].technician
      if (!tech?.line_user_id) continue
      await notifyDailySchedule({
        technician_line_id: tech.line_user_id,
        technician_name: tech.name,
        date: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }),
        jobs: jobs.map(j => ({ title: j.title, time: j.scheduled_time?.slice(0,5)||'', address: j.address, job_id: j.id })),
        app_url: appUrl,
      })
      results.push(`daily_schedule → ${tech.name}`)
    }
  }

  // ── 2. Mark overdue + แจ้ง Admin ─────────────────────────────────────────
  const { data: overdueJobs } = await supabaseAdmin
    .from('jobs').select('*, technician:technicians(*), customer:customers(*)')
    .lt('scheduled_date', today).in('status', ['pending', 'assigned', 'heading', 'in_progress'])

  if (overdueJobs?.length) {
    await supabaseAdmin.from('jobs').update({ status: 'overdue' })
      .in('id', overdueJobs.map(j => j.id))
    const adminLineId = process.env.ADMIN_LINE_USER_ID
    if (adminLineId) {
      for (const job of overdueJobs) {
        await notifyOverdue({
          job_id: job.id, admin_line_id: adminLineId,
          job_title: job.title,
          customer_name: (job as unknown as {customer:{name:string}}).customer?.name || '',
          technician_name: (job as unknown as {technician:{name:string}}).technician?.name || 'ไม่มีช่าง',
          scheduled_date: job.scheduled_date, app_url: appUrl,
        })
        results.push(`overdue → ${job.title}`)
      }
    }
  }

  // ── 3. ทวงค่าค้างชำระ — ตาม reminder config ──────────────────────────────
  const { data: configs } = await supabaseAdmin
    .from('payment_reminder_configs').select('*').eq('active', true)

  const { data: unpaidInvoices } = await supabaseAdmin
    .from('invoices')
    .select('*, customer:customers(name,phone,line_user_id,id)')
    .in('status', ['unpaid', 'partial'])
    .not('due_date', 'is', null)

  for (const inv of unpaidInvoices || []) {
    const dueDate = new Date(inv.due_date)
    const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / 86400000)
    const cust = (inv as unknown as {customer:{name:string,line_user_id?:string,id:string}}).customer

    for (const cfg of configs || []) {
      if (daysOverdue !== cfg.days_after) continue

      const msg = cfg.message_tpl
        .replace('{customer_name}', cust?.name || '')
        .replace('{invoice_no}', inv.invoice_no)
        .replace('{amount}', (inv.total - (inv.paid_amount||0)).toLocaleString())
        .replace('{due_date}', inv.due_date)
        .replace('{days_overdue}', String(daysOverdue))

      // ส่งผ่าน LINE group (ถ้ามี) — ขุนทองจะเห็นด้วย
      const { data: gs } = await supabaseAdmin
        .from('line_group_settings').select('group_id,khunthong_added')
        .eq('customer_id', cust?.id).single()

      if (gs?.group_id) {
        // ส่ง reminder เข้า group + Invoice card ถ้าขุนทองอยู่ใน group
        await sendGroupMessage(gs.group_id, [{ type: 'text', text: msg }])
        if (gs.khunthong_added) {
          // ส่ง Invoice card ซ้ำเพื่อให้ขุนทองช่วยติดตาม
          await sendInvoiceToGroup({
            groupId: gs.group_id,
            invoiceNo: inv.invoice_no,
            customerName: cust?.name || '',
            amount: inv.total || 0,
            paidAmount: inv.paid_amount || 0,
            dueDate: inv.due_date,
            bankAccount: inv.bank_account,
            qrCodeUrl: inv.qr_code_url,
            invoiceUrl: `${appUrl}/invoices/${inv.id}`,
          })
        }
        results.push(`reminder(group,d${daysOverdue}) → ${inv.invoice_no}`)
      } else if (cust?.line_user_id) {
        // fallback: ส่ง push message ตรง
        const { token } = await getLineOACredentials()
        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body: JSON.stringify({ to: cust.line_user_id, messages: [{ type:'text', text: msg }] }),
        })
        results.push(`reminder(dm,d${daysOverdue}) → ${inv.invoice_no}`)
      }
    }
  }

  return NextResponse.json({ success: true, results, date: today })
}
