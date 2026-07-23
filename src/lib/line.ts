import axios from 'axios'
import { supabaseAdmin } from './supabase'
import { getLineOACredentials } from './line-config'

const LINE_API = 'https://api.line.me/v2/bot/message'

const headersFor = async (oaAccountId?: string | null) => {
  const { token } = await getLineOACredentials(oaAccountId)
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

// ─── Core push function ───────────────────────────────────────────────────────
export async function pushMessage(lineUserId: string, messages: object[], oaAccountId?: string | null) {
  try {
    await axios.post(`${LINE_API}/push`, {
      to: lineUserId,
      messages,
    }, { headers: await headersFor(oaAccountId) })
    return { success: true }
  } catch (err: unknown) {
    // axios ให้แค่ "Request failed with status code 400" เฉยๆ ไม่บอกสาเหตุจริง
    // ต้องดึง response.data จาก LINE ออกมาด้วย ถึงจะรู้ว่า field ไหนผิด/ทำไมถูกปฏิเสธ
    let msg = err instanceof Error ? err.message : String(err)
    if (axios.isAxiosError(err) && err.response?.data) {
      msg = `${msg} — LINE ตอบ: ${JSON.stringify(err.response.data)}`
    }
    console.error('[LINE] push error:', msg)
    return { success: false, error: msg }
  }
}

// ─── จดจำ userId/groupId ที่เคยติดต่อเข้ามา — ให้แอดมินคัดลอกใช้จากหน้า Settings ──
// เรียกจาก webhook ทุกครั้งที่มี follow / join / message เข้ามา
async function fetchLineProfile(userId: string, oaAccountId?: string | null): Promise<{ name?: string; picture?: string }> {
  try {
    const res = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, { headers: await headersFor(oaAccountId) })
    return { name: res.data?.displayName, picture: res.data?.pictureUrl }
  } catch {
    return {} // ปกติถ้าเป็นเพื่อนกันอยู่จะดึงได้ ถ้า unfollow ไปแล้วจะดึงไม่ได้ ไม่เป็นไร
  }
}

async function fetchLineGroupSummary(groupId: string, oaAccountId?: string | null): Promise<{ name?: string; picture?: string }> {
  try {
    const res = await axios.get(`https://api.line.me/v2/bot/group/${groupId}/summary`, { headers: await headersFor(oaAccountId) })
    return { name: res.data?.groupName, picture: res.data?.pictureUrl }
  } catch {
    return {}
  }
}

export async function recordSeenContact(opts: {
  kind: 'user' | 'group'
  lineId: string
  oaAccountId?: string | null
  lastMessage?: string
  autoCreateCustomer?: boolean // true เฉพาะตอน follow event (แอดเพื่อน 1:1) กันสร้างลูกค้าปลอมจากคนพิมพ์ในกลุ่ม
}) {
  const { kind, lineId, oaAccountId, lastMessage, autoCreateCustomer } = opts
  try {
    const { data: existing } = await supabaseAdmin
      .from('line_seen_contacts').select('id, display_name, profile_synced_at').eq('line_id', lineId).maybeSingle()

    // ดึงชื่อ/รูปจาก LINE ตอนยังไม่เคยเห็น, ยังไม่มีชื่อ, หรือดึงมาเกิน 24 ชม.แล้ว
    // (กันยิง API ซ้ำทุกข้อความ แต่ก็รีเฟรชเป็นระยะ เผื่อลูกค้าเปลี่ยนชื่อ LINE ทีหลัง
    // ชื่อจริงในระบบจะได้ไม่ค้างเก่าตลอดไป)
    const isStale = !existing?.profile_synced_at ||
      Date.now() - new Date(existing.profile_synced_at).getTime() > 24 * 60 * 60 * 1000
    let name: string | undefined
    let picture: string | undefined
    if (!existing || !existing.display_name || isStale) {
      const fetched = kind === 'user' ? await fetchLineProfile(lineId, oaAccountId) : await fetchLineGroupSummary(lineId, oaAccountId)
      name = fetched.name
      picture = fetched.picture
    }

    if (existing) {
      await supabaseAdmin.from('line_seen_contacts').update({
        ...(name ? { display_name: name, profile_synced_at: new Date().toISOString() } : {}),
        ...(picture ? { picture_url: picture } : {}),
        ...(lastMessage ? { last_message: lastMessage } : {}),
        oa_account_id: oaAccountId || null,
        last_seen_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await supabaseAdmin.from('line_seen_contacts').insert({
        kind, line_id: lineId, display_name: name, picture_url: picture,
        last_message: lastMessage, oa_account_id: oaAccountId || null,
        profile_synced_at: name ? new Date().toISOString() : null,
      })
    }

    // ── แอดเพื่อนครั้งแรก (follow event เท่านั้น) → สร้างรายชื่อลูกค้าอัตโนมัติทันที ──
    // ให้เห็นในเมนู "ลูกค้า" และเลือกได้ตอนจัดคิวช่างเลย ไม่ต้องรอลูกค้าพิมพ์เบอร์โทร
    // เบอร์โทร/ที่อยู่จะว่างไว้ก่อน แอดมินกรอกเพิ่มทีหลังได้จากหน้าลูกค้า
    // (จำกัดเฉพาะ follow event เพื่อไม่ให้สร้างลูกค้าปลอมจากคนที่แค่พิมพ์ในกลุ่มไลน์ เช่น ช่าง/ทีมงาน)
    if (kind === 'user' && autoCreateCustomer) {
      await autoCreateCustomerFromLineContact(lineId, name)
    }
  } catch (err) {
    console.error('[LINE] recordSeenContact error:', err instanceof Error ? err.message : err)
  }
}

async function autoCreateCustomerFromLineContact(lineUserId: string, displayName?: string) {
  try {
    const { data: existingCustomer } = await supabaseAdmin
      .from('customers').select('id').eq('line_user_id', lineUserId).maybeSingle()
    if (existingCustomer) return // มีลูกค้าผูกกับ userId นี้อยู่แล้ว ไม่ต้องสร้างซ้ำ

    await supabaseAdmin.from('customers').insert({
      name: displayName || 'ลูกค้าใหม่ (LINE)',
      phone: '',
      address: '',
      line_user_id: lineUserId,
      notes: 'สร้างอัตโนมัติตอนแอดเพื่อน LINE OA — กรอกเบอร์โทร/ที่อยู่เพิ่มได้ที่นี่',
    })
  } catch (err) {
    console.error('[LINE] autoCreateCustomerFromLineContact error:', err instanceof Error ? err.message : err)
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
  scheduled_time?: string | null
  address: string
  app_url: string
  oa_account_id?: string | null
}) {
  const text =
    `✅ ยืนยันนัดหมาย\n\n` +
    `สวัสดีค่ะ คุณ${opts.customer_name}\n` +
    `รับแจ้งงาน: ${opts.job_title}\n\n` +
    `📅 วันที่: ${opts.scheduled_date}\n` +
    (opts.scheduled_time ? `⏰ เวลา: ${opts.scheduled_time.slice(0,5)} น.\n` : `⏰ เวลา: ทีมงานจะจัดคิวและแจ้งเวลาให้ทราบอีกครั้ง\n`) +
    `📍 สถานที่: ${opts.address}\n\n` +
    `ดูรายละเอียดงาน:\n${opts.app_url}/jobs/${opts.job_id}`

  const result = await pushMessage(opts.customer_line_id, [{ type: 'text', text }], opts.oa_account_id)
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

// 2. แจ้งช่างรายละเอียดงาน + แผนที่
export async function notifyTechnicianAssigned(opts: {
  job_id: string
  technician_line_id: string
  technician_name: string
  job_title: string
  scheduled_date: string
  scheduled_date_iso: string
  scheduled_time?: string | null
  address: string
  customer_name: string
  customer_phone: string
  app_url: string
  lat?: number | null
  lng?: number | null
  amount?: number | null
  deposit_amount?: number | null
  vat_amount?: number | null
  oa_account_id?: string | null
}) {
  // ── Flex Message รายละเอียดงาน ───────────────────────────────────────────
  const mapsUrl = opts.lat && opts.lng
    ? `https://www.google.com/maps?q=${opts.lat},${opts.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opts.address)}`

  const staticMapUrl = opts.lat && opts.lng
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${opts.lat},${opts.lng}&zoom=15&size=600x300&markers=color:red%7C${opts.lat},${opts.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    : null

  const flexMsg = {
    type: 'flex',
    altText: `🔧 งานใหม่: ${opts.job_title} — ${opts.scheduled_date}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#185FA5', paddingAll: '16px',
        contents: [
          { type: 'text', text: '🔧 งานใหม่มอบหมายแล้ว', color: '#ffffff', size: 'sm', weight: 'bold' },
          { type: 'text', text: `สวัสดีครับ คุณ${opts.technician_name}`, color: '#D0E8FF', size: 'xs', margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
        contents: [
          { type: 'text', text: opts.job_title || '-', weight: 'bold', size: 'md', wrap: true, color: '#0F2027' },
          { type: 'separator', margin: 'md' },
          ...[
            ['📅 วันที่', `${opts.scheduled_date} ${opts.scheduled_time ? opts.scheduled_time.slice(0,5)+' น.' : ''}`],
            ['👤 ลูกค้า', opts.customer_name],
            ['📱 โทร', opts.customer_phone],
            ['📍 สถานที่', opts.address],
          ].map(([label, value]) => ({
            type: 'box', layout: 'horizontal', margin: 'sm',
            contents: [
              { type: 'text', text: label, color: '#888888', size: 'sm', flex: 3 },
              // LINE ปฏิเสธข้อความทั้งก้อนถ้ามี text block ไหนเป็นค่าว่าง (เช่น ลูกค้ายังไม่กรอกเบอร์โทร)
              { type: 'text', text: (value && String(value).trim()) || '-', size: 'sm', flex: 5, wrap: true, color: '#0F2027' },
            ],
          })),
          // ── ยอดที่ต้องเก็บจากลูกค้า (โชว์เฉพาะเมื่อมีการระบุยอดไว้) ──────────
          ...(opts.amount ? [
            { type: 'separator', margin: 'md' },
            {
              type: 'box', layout: 'vertical', margin: 'md', backgroundColor: '#FFF8E1',
              cornerRadius: 'md', paddingAll: '10px', spacing: 'xs',
              contents: [
                { type: 'text', text: '💰 ยอดที่ต้องเก็บจากลูกค้า', color: '#8A6D00', size: 'xs', weight: 'bold' },
                {
                  type: 'box', layout: 'horizontal', contents: [
                    { type: 'text', text: 'ยอดรวม', color: '#888888', size: 'sm', flex: 4 },
                    { type: 'text', text: `฿${Number(opts.amount).toLocaleString()}`, size: 'sm', flex: 5, align: 'end', weight: 'bold', color: '#0F2027' },
                  ],
                },
                ...(opts.vat_amount ? [{
                  type: 'box', layout: 'horizontal', contents: [
                    { type: 'text', text: '(รวม VAT)', color: '#aaaaaa', size: 'xs', flex: 4 },
                    { type: 'text', text: `฿${Number(opts.vat_amount).toLocaleString()}`, size: 'xs', flex: 5, align: 'end', color: '#aaaaaa' },
                  ],
                }] : []),
                ...(opts.deposit_amount ? [{
                  type: 'box', layout: 'horizontal', contents: [
                    { type: 'text', text: 'มัดจำ/ชำระแล้ว', color: '#888888', size: 'sm', flex: 4 },
                    { type: 'text', text: `฿${Number(opts.deposit_amount).toLocaleString()}`, size: 'sm', flex: 5, align: 'end', color: '#0F6E56' },
                  ],
                }] : []),
                {
                  type: 'box', layout: 'horizontal', contents: [
                    { type: 'text', text: 'คงเหลือเก็บจากลูกค้า', color: '#8A6D00', size: 'sm', flex: 4, weight: 'bold' },
                    { type: 'text', text: `฿${(Number(opts.amount) + Number(opts.vat_amount || 0) - Number(opts.deposit_amount || 0)).toLocaleString()}`, size: 'sm', flex: 5, align: 'end', weight: 'bold', color: '#C0392B' },
                  ],
                },
              ],
            },
          ] : []),
          // Static map image (ถ้ามี lat/lng)
          ...(staticMapUrl ? [{
            type: 'image',
            url: staticMapUrl,
            size: 'full',
            aspectRatio: '20:9',
            aspectMode: 'cover',
            margin: 'md',
            action: { type: 'uri', uri: mapsUrl },
          }] : []),
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
        contents: [
          {
            type: 'button', style: 'primary', color: '#185FA5', height: 'sm',
            action: { type: 'uri', label: '🗺️ เปิดแผนที่นำทาง', uri: mapsUrl },
          },
          {
            type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'uri', label: '✅ รับงาน / ดูรายละเอียด', uri: `${opts.app_url}/technician/${opts.job_id}` },
          },
          {
            type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'uri', label: '🗺️ แผนที่ + เส้นทางงานวันนี้ (AI)', uri: `${opts.app_url}/technician/map?date=${opts.scheduled_date_iso}` },
          },
        ],
      },
    },
  }

  const messages: object[] = [flexMsg]

  // ── Location message (ถ้ามี lat/lng) ────────────────────────────────────
  if (opts.lat && opts.lng) {
    messages.push({
      type: 'location',
      title: opts.job_title,
      address: opts.address,
      latitude: opts.lat,
      longitude: opts.lng,
    })
  }

  const result = await pushMessage(opts.technician_line_id, messages, opts.oa_account_id)
  await logNotification({
    job_id: opts.job_id,
    recipient: 'technician',
    line_user_id: opts.technician_line_id,
    type: 'technician_assigned',
    message: `งาน: ${opts.job_title} | ${opts.address}`,
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
  oa_account_id?: string | null
}) {
  const text =
    `🚗 ช่างกำลังเดินทาง\n\n` +
    `สวัสดีค่ะ คุณ${opts.customer_name}\n` +
    `ช่าง ${opts.technician_name} รับงานของคุณแล้ว\n` +
    `กำลังเดินทางไปยังบ้านคุณค่ะ\n\n` +
    `📱 ติดต่อช่าง: ${opts.technician_phone}`

  const result = await pushMessage(opts.customer_line_id, [{ type: 'text', text }], opts.oa_account_id)
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

// 3.5 แจ้งช่างเอง (ยืนยันการกดรับงาน / กดบันทึกเริ่มงาน)
export async function notifyTechnicianJobUpdate(opts: {
  job_id: string
  technician_line_id: string
  job_title: string
  stage: 'heading' | 'in_progress'
  oa_account_id?: string | null
}) {
  const text = opts.stage === 'heading'
    ? `✅ คุณรับงาน "${opts.job_title}" แล้ว\nกำลังมุ่งหน้าไปหน้างานนะครับ ขับขี่ปลอดภัยครับ 🚗`
    : `📸 บันทึกเริ่มงาน "${opts.job_title}" เรียบร้อยแล้ว\nลุยงานได้เลยครับ 💪`

  const result = await pushMessage(opts.technician_line_id, [{ type: 'text', text }], opts.oa_account_id)
  await logNotification({
    job_id: opts.job_id,
    recipient: 'technician',
    line_user_id: opts.technician_line_id,
    type: opts.stage === 'heading' ? 'technician_heading_ack' : 'technician_in_progress_ack',
    message: text,
    ...result,
  })
  return result
}

// 3.6 แจ้งลูกค้า — ช่างเริ่มดำเนินงานแล้ว (หลังถ่ายรูปหน้างานก่อนเริ่ม + กดบันทึก)
export async function notifyJobInProgress(opts: {
  job_id: string
  customer_line_id: string
  customer_name: string
  technician_name: string
  oa_account_id?: string | null
}) {
  const text =
    `🔧 เริ่มดำเนินงานแล้ว\n\n` +
    `สวัสดีค่ะ คุณ${opts.customer_name}\n` +
    `ช่าง ${opts.technician_name} เริ่มดำเนินการที่หน้างานของคุณแล้วค่ะ`

  const result = await pushMessage(opts.customer_line_id, [{ type: 'text', text }], opts.oa_account_id)
  await logNotification({
    job_id: opts.job_id,
    recipient: 'customer',
    line_user_id: opts.customer_line_id,
    type: 'job_in_progress',
    message: text,
    ...result,
  })
  return result
}

// 3.65 แจ้งเตือนเมื่อมีการแก้ไขข้อมูลงาน (วันที่/เวลา/ที่อยู่/ยอด ฯลฯ) — ส่งรายละเอียดว่าแก้อะไรบ้าง
export async function notifyJobEdited(opts: {
  job_id: string
  recipient: 'technician' | 'customer'
  line_user_id: string
  job_title: string
  changesText: string
  oa_account_id?: string | null
}) {
  const who = opts.recipient === 'technician' ? 'ครับ' : 'ค่ะ'
  const text = `✏️ มีการแก้ไขข้อมูลงาน "${opts.job_title}"${who}\n\n${opts.changesText}`

  const result = await pushMessage(opts.line_user_id, [{ type: 'text', text }], opts.oa_account_id)
  await logNotification({
    job_id: opts.job_id, recipient: opts.recipient, line_user_id: opts.line_user_id,
    type: 'job_edited', message: text, ...result,
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
  oa_account_id?: string | null
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

  const result = await pushMessage(opts.customer_line_id, messages, opts.oa_account_id)
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
  oa_account_id?: string | null
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
    `\n\nดูทั้งหมด:\n${opts.app_url}/technician`

  const result = await pushMessage(opts.technician_line_id, [{ type: 'text', text }], opts.oa_account_id)
  return result
}

// ─── ส่งข้อความเข้า LINE Group ───────────────────────────────────────────────
export async function sendGroupMessage(groupId: string, messages: object[], oaAccountId?: string | null) {
  try {
    const { token } = await getLineOACredentials(oaAccountId)
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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
            { type: 'text', text: (opts.customerName && opts.customerName.trim()) || '-', size: 'sm', flex: 4, wrap: true },
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

// ─── Invoice แบบ text (งานติดตั้ง ไม่มีรายการสินค้า) ─────────────────────────
// ใช้รูปแบบข้อความล้วน (ไม่ใช่ flex) เพื่อให้เข้ากันได้กับ @ขุนทอง (KBank) ที่อ่าน/ตอบกลับ
// ข้อความในกลุ่มได้ดีกว่า และลูกค้าสามารถ forward/แคปหน้าจอส่งต่อได้ง่าย
export function buildInvoiceText(opts: {
  invoiceNo: string
  customerName: string
  jobTitle?: string
  amount: number
  paidAmount?: number
  vatAmount?: number | null
  dueDate?: string | null
  bankAccount?: string | null
  qrCodeUrl?: string | null
  customFields?: Record<string, string> | null
  fieldLabels?: Record<string, string> // field_key -> label
  invoiceUrl?: string
}) {
  const paid = opts.paidAmount || 0
  const remain = opts.amount - paid
  const dueDateStr = opts.dueDate
    ? new Date(opts.dueDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'ไม่กำหนด'

  const customLines = opts.customFields && opts.fieldLabels
    ? Object.entries(opts.customFields)
        .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
        .map(([k, v]) => `${opts.fieldLabels?.[k] || k}: ${v}`)
        .join('\n')
    : ''

  return (
    `🧾 ใบแจ้งหนี้ค่าติดตั้ง\n` +
    `เลขที่: ${opts.invoiceNo}\n\n` +
    `สวัสดีค่ะ คุณ${opts.customerName}\n` +
    (opts.jobTitle ? `งาน: ${opts.jobTitle}\n` : '') +
    (customLines ? `${customLines}\n` : '') +
    `\n💰 ยอดรวม: ${opts.amount.toLocaleString()} บาท\n` +
    (opts.vatAmount ? `(รวม VAT: ${opts.vatAmount.toLocaleString()} บาท)\n` : '') +
    (paid ? `มัดจำ/ชำระแล้ว: ${paid.toLocaleString()} บาท\n` : '') +
    `คงเหลือ: ${remain.toLocaleString()} บาท\n` +
    `ครบกำหนด: ${dueDateStr}\n` +
    (opts.bankAccount ? `🏦 โอนเข้าบัญชี: ${opts.bankAccount}\n` : '') +
    (opts.qrCodeUrl ? `📲 QR ชำระเงิน: ${opts.qrCodeUrl}\n` : '') +
    (opts.invoiceUrl ? `\nดูรายละเอียด: ${opts.invoiceUrl}\n` : '') +
    `\n💬 พิมพ์ "โอนแล้ว" หรือส่งสลิปในแชทเพื่อยืนยันการชำระค่ะ\n` +
    `ขอบคุณที่ใช้บริการค่ะ 🙏`
  )
}

// ส่ง Invoice (text) ตรงเข้า LINE DM ของลูกค้า
export async function notifyInvoiceToCustomer(opts: {
  job_id?: string
  invoice_id: string
  customer_line_id: string
  text: string
  oa_account_id?: string | null
}) {
  const result = await pushMessage(opts.customer_line_id, [{ type: 'text', text: opts.text }], opts.oa_account_id)
  if (opts.job_id) {
    await logNotification({
      job_id: opts.job_id,
      recipient: 'customer',
      line_user_id: opts.customer_line_id,
      type: 'invoice_sent',
      message: opts.text,
      ...result,
    })
  }
  return result
}

// ส่ง Invoice (text) เข้า LINE Group ของลูกค้า (กลุ่มที่มี @ขุนทอง อยู่ด้วย)
export async function sendInvoiceTextToGroup(groupId: string, text: string, oaAccountId?: string | null) {
  return sendGroupMessage(groupId, [{ type: 'text', text }], oaAccountId)
}

// ─── แจ้งเตือนฝ่ายบัญชี/ผู้บริหาร (รายบุคคล + กลุ่มภายใน) ────────────────────
// ใช้ตอน Invoice เปลี่ยนสถานะ (ส่งแล้ว/ชำระแล้ว/เกินกำหนด) ให้บัญชี+ผู้บริหารรับทราบทุกครั้ง
// แต่ละคน/กลุ่มอาจผูกกับ OA คนละบัญชี — ส่งผ่าน OA ของตัวเองอัตโนมัติ
export async function notifyAccountingAndManagement(text: string) {
  const [{ data: accounts }, { data: groups }] = await Promise.all([
    supabaseAdmin.from('notify_accounts').select('line_user_id, oa_account_id').eq('active', true)
      .in('account_type', ['accounting', 'management']),
    supabaseAdmin.from('internal_line_groups').select('line_group_id, oa_account_id').eq('active', true)
      .in('group_type', ['accounting', 'management']),
  ])

  await Promise.all([
    ...(accounts || []).map(a => pushMessage(a.line_user_id, [{ type: 'text', text }], a.oa_account_id)),
    ...(groups || []).map(g => sendGroupMessage(g.line_group_id, [{ type: 'text', text }], g.oa_account_id)),
  ])
}

// ─── Broadcast ตาม event ที่แต่ละกลุ่มเลือก subscribe ไว้ ───────────────────────
// ใช้กับกลุ่ม LINE ใน internal_line_groups ที่ active=true และมี eventType อยู่ใน notify_events
// แต่ละกลุ่มอาจผูกกับ OA คนละบัญชี (ถ้าเชิญ OA คนละตัวเข้ากลุ่มนั้น) — ระบบส่งผ่าน OA ที่ถูกต้องของแต่ละกลุ่มให้อัตโนมัติ
export const NOTIFY_EVENT_TYPES = ['new_job', 'job_edited', 'invoice_sent', 'payment_confirmed', 'job_completed'] as const
export type NotifyEventType = typeof NOTIFY_EVENT_TYPES[number]

export async function notifyEventGroups(eventType: NotifyEventType, text: string) {
  const { data: groups } = await supabaseAdmin
    .from('internal_line_groups')
    .select('line_group_id, oa_account_id')
    .eq('active', true)
    .contains('notify_events', [eventType])

  const results = await Promise.all(
    (groups || []).map(g => sendGroupMessage(g.line_group_id, [{ type: 'text', text }], g.oa_account_id))
  )
  return { sent: results.filter(r => r.success).length, total: (groups || []).length }
}

// ─── Keyword checker ─────────────────────────────────────────────────────────
export function isPaymentConfirmKeyword(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase().trim()
  return keywords.some(kw => t.includes(kw.toLowerCase()))
}
