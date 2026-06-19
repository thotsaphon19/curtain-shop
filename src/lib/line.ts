import axios from 'axios'
import { supabaseAdmin } from './supabase'

const LINE_API = 'https://api.line.me/v2/bot/message'

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
})

// ─── Core push function ───────────────────────────────────────────────────────
async function pushMessage(lineUserId: string, messages: object[]) {
  try {
    await axios.post(`${LINE_API}/push`, {
      to: lineUserId,
      messages,
    }, { headers: headers() })
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[LINE] push error:', msg)
    return { success: false, error: msg }
  }
}

// ─── Log helper ──────────────────────────────────────────────────────────────
async function logNotification(opts: {
  job_id: string
  recipient: 'customer' | 'technician' | 'admin'
  line_user_id?: string
  type: string
  message: string
  success: boolean
  error_msg?: string
}) {
  await supabaseAdmin.from('notification_logs').insert(opts)
}

// ─── Notification templates ──────────────────────────────────────────────────

// 1. ยืนยันนัดหมายลูกค้า (Admin ลงคิวเสร็จ)
export async function notifyBookingConfirm(opts: {
  job_id: string
  customer_line_id: string
  customer_name: string
  job_title: string
  scheduled_date: string
  scheduled_time: string
  address: string
  app_url: string
}) {
  const text =
    `✅ ยืนยันนัดหมาย\n\n` +
    `สวัสดีค่ะ คุณ${opts.customer_name}\n` +
    `รับแจ้งงาน: ${opts.job_title}\n\n` +
    `📅 วันที่: ${opts.scheduled_date}\n` +
    `⏰ เวลา: ${opts.scheduled_time} น.\n` +
    `📍 สถานที่: ${opts.address}\n\n` +
    `ดูรายละเอียดงาน:\n${opts.app_url}/jobs/${opts.job_id}`

  const result = await pushMessage(opts.customer_line_id, [{ type: 'text', text }])
  await logNotification({
    job_id: opts.job_id,
    recipient: 'customer',
    line_user_id: opts.customer_line_id,
    type: 'booking_confirm',
    message: text,
    ...result,
  })
  return result
}

// 2. แจ้งช่างรายละเอียดงาน
export async function notifyTechnicianAssigned(opts: {
  job_id: string
  technician_line_id: string
  technician_name: string
  job_title: string
  scheduled_date: string
  scheduled_time: string
  address: string
  customer_name: string
  customer_phone: string
  app_url: string
}) {
  const text =
    `🔧 มีงานใหม่!\n\n` +
    `สวัสดีครับ คุณ${opts.technician_name}\n` +
    `งาน: ${opts.job_title}\n\n` +
    `📅 วันที่: ${opts.scheduled_date}\n` +
    `⏰ เวลา: ${opts.scheduled_time} น.\n` +
    `📍 สถานที่: ${opts.address}\n\n` +
    `👤 ลูกค้า: ${opts.customer_name}\n` +
    `📱 โทร: ${opts.customer_phone}\n\n` +
    `กดรับงาน:\n${opts.app_url}/technician/${opts.job_id}`

  const result = await pushMessage(opts.technician_line_id, [{ type: 'text', text }])
  await logNotification({
    job_id: opts.job_id,
    recipient: 'technician',
    line_user_id: opts.technician_line_id,
    type: 'technician_assigned',
    message: text,
    ...result,
  })
  return result
}

// 3. แจ้งลูกค้าว่าช่างกำลังเดินทาง
export async function notifyOnTheWay(opts: {
  job_id: string
  customer_line_id: string
  customer_name: string
  technician_name: string
  technician_phone: string
}) {
  const text =
    `🚗 ช่างกำลังเดินทาง\n\n` +
    `สวัสดีค่ะ คุณ${opts.customer_name}\n` +
    `ช่าง ${opts.technician_name} รับงานของคุณแล้ว\n` +
    `กำลังเดินทางไปยังบ้านคุณค่ะ\n\n` +
    `📱 ติดต่อช่าง: ${opts.technician_phone}`

  const result = await pushMessage(opts.customer_line_id, [{ type: 'text', text }])
  await logNotification({
    job_id: opts.job_id,
    recipient: 'customer',
    line_user_id: opts.customer_line_id,
    type: 'on_the_way',
    message: text,
    ...result,
  })
  return result
}

// 4. ปิดงาน แจ้งลูกค้าพร้อมชำระเงิน
export async function notifyJobCompleted(opts: {
  job_id: string
  customer_line_id: string
  customer_name: string
  technician_name: string
  end_photo_url?: string
  amount?: number
  bank_account?: string
  qr_code_url?: string
}) {
  const paymentLine = opts.amount
    ? `\n💰 ยอดชำระ: ${opts.amount.toLocaleString()} บาท` +
      (opts.bank_account ? `\n🏦 โอน: ${opts.bank_account}` : '') +
      (opts.qr_code_url ? `\n📲 QR: ${opts.qr_code_url}` : '')
    : ''

  const text =
    `✅ งานเสร็จสมบูรณ์!\n\n` +
    `สวัสดีค่ะ คุณ${opts.customer_name}\n` +
    `ช่าง ${opts.technician_name} ปิดงานเรียบร้อยแล้วค่ะ` +
    (opts.end_photo_url ? `\n\n📸 รูปผลงาน: ${opts.end_photo_url}` : '') +
    paymentLine +
    `\n\nขอบคุณที่ใช้บริการค่ะ 🙏`

  const messages: object[] = [{ type: 'text', text }]

  // ส่งรูปถ้ามี
  if (opts.end_photo_url) {
    messages.push({
      type: 'image',
      originalContentUrl: opts.end_photo_url,
      previewImageUrl: opts.end_photo_url,
    })
  }

  const result = await pushMessage(opts.customer_line_id, messages)
  await logNotification({
    job_id: opts.job_id,
    recipient: 'customer',
    line_user_id: opts.customer_line_id,
    type: 'job_done',
    message: text,
    ...result,
  })
  return result
}

// 5. แจ้งงานค้าง → Admin
export async function notifyOverdue(opts: {
  job_id: string
  admin_line_id: string
  job_title: string
  customer_name: string
  technician_name: string
  scheduled_date: string
  app_url: string
}) {
  const text =
    `⚠️ แจ้งงานค้าง\n\n` +
    `งาน: ${opts.job_title}\n` +
    `ลูกค้า: ${opts.customer_name}\n` +
    `ช่าง: ${opts.technician_name}\n` +
    `กำหนด: ${opts.scheduled_date}\n\n` +
    `ดูรายละเอียด:\n${opts.app_url}/jobs/${opts.job_id}`

  const result = await pushMessage(opts.admin_line_id, [{ type: 'text', text }])
  await logNotification({
    job_id: opts.job_id,
    recipient: 'admin',
    line_user_id: opts.admin_line_id,
    type: 'overdue',
    message: text,
    ...result,
  })
  return result
}

// 6. ตารางงานประจำวัน → ช่าง (08:00 น.)
export async function notifyDailySchedule(opts: {
  technician_line_id: string
  technician_name: string
  jobs: Array<{ title: string; time: string; address: string; job_id: string }>
  date: string
  app_url: string
}) {
  if (opts.jobs.length === 0) return { success: true }

  const jobLines = opts.jobs
    .map((j, i) => `${i + 1}. [${j.time}] ${j.title}\n   📍 ${j.address}`)
    .join('\n\n')

  const text =
    `📋 ตารางงานประจำวัน\n` +
    `วันที่: ${opts.date}\n\n` +
    `สวัสดีครับ คุณ${opts.technician_name}\n` +
    `วันนี้มีงาน ${opts.jobs.length} รายการ:\n\n` +
    jobLines +
    `\n\nดูทั้งหมด:\n${opts.app_url}/technician/schedule`

  const result = await pushMessage(opts.technician_line_id, [{ type: 'text', text }])
  return result
}

// ─── ส่งข้อความเข้า LINE Group ───────────────────────────────────────────────
export async function sendGroupMessage(groupId: string, messages: object[]) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: groupId, messages }),
    })
    const data = await res.json().catch(() => ({}))
    return { success: res.ok, messageId: (data as {sentMessages?:{id:string}[]}).sentMessages?.[0]?.id }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ─── ส่ง Invoice เข้า Group พร้อม Flex Message ───────────────────────────────
export async function sendInvoiceToGroup(opts: {
  groupId: string
  invoiceNo: string
  customerName: string
  amount: number
  paidAmount: number
  dueDate?: string
  bankAccount?: string
  qrCodeUrl?: string
  invoiceUrl: string
}) {
  const remain = opts.amount - opts.paidAmount
  const dueDateStr = opts.dueDate
    ? new Date(opts.dueDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'ไม่กำหนด'

  // Flex Message — card สวย บนมือถือ
  const flexMsg = {
    type: 'flex',
    altText: `Invoice ${opts.invoiceNo} — ยอดค้าง ฿${remain.toLocaleString()}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#0F6E56',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: '🧾 ใบแจ้งหนี้', color: '#ffffff', size: 'sm', weight: 'bold' },
          { type: 'text', text: opts.invoiceNo, color: '#ffffff', size: 'xl', weight: 'bold', margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'md',
        contents: [
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'ลูกค้า', color: '#888888', size: 'sm', flex: 2 },
            { type: 'text', text: opts.customerName, size: 'sm', flex: 4, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'ยอดรวม', color: '#888888', size: 'sm', flex: 2 },
            { type: 'text', text: `฿${opts.amount.toLocaleString()}`, size: 'sm', flex: 4 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'ชำระแล้ว', color: '#888888', size: 'sm', flex: 2 },
            { type: 'text', text: `฿${opts.paidAmount.toLocaleString()}`, size: 'sm', color: '#3B6D11', flex: 4 },
          ]},
          { type: 'separator' },
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'คงเหลือ', color: '#A32D2D', size: 'md', weight: 'bold', flex: 2 },
            { type: 'text', text: `฿${remain.toLocaleString()}`, size: 'md', weight: 'bold', color: '#A32D2D', flex: 4 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'ครบกำหนด', color: '#888888', size: 'sm', flex: 2 },
            { type: 'text', text: dueDateStr, size: 'sm', flex: 4 },
          ]},
          ...(opts.bankAccount ? [{ type: 'box' as const, layout: 'horizontal' as const, contents: [
            { type: 'text' as const, text: 'โอนเงิน', color: '#888888', size: 'sm' as const, flex: 2 },
            { type: 'text' as const, text: opts.bankAccount, size: 'sm' as const, flex: 4, wrap: true },
          ]}] : []),
          {
            type: 'text',
            text: '💬 พิมพ์ "โอนแล้ว" หรือส่งสลิปเพื่อยืนยันการชำระค่ะ',
            size: 'xs', color: '#888888', wrap: true, margin: 'md',
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'sm',
        contents: [
          {
            type: 'button', style: 'primary', color: '#0F6E56', height: 'sm',
            action: { type: 'uri', label: 'ดูรายละเอียด', uri: opts.invoiceUrl },
          },
          ...(opts.qrCodeUrl ? [{
            type: 'button' as const, style: 'secondary' as const, height: 'sm' as const,
            action: { type: 'uri' as const, label: '📲 QR Code ชำระเงิน', uri: opts.qrCodeUrl },
          }] : []),
        ],
      },
    },
  }

  return sendGroupMessage(opts.groupId, [flexMsg])
}

// ─── Keyword checker ─────────────────────────────────────────────────────────
export function isPaymentConfirmKeyword(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase().trim()
  return keywords.some(kw => t.includes(kw.toLowerCase()))
}
