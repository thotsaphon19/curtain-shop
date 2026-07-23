import { supabaseAdmin } from '@/lib/supabase'
import { isPaymentConfirmKeyword, sendGroupMessage, notifyAccountingAndManagement, notifyEventGroups, recordSeenContact } from '@/lib/line'
import { createWebNotification } from '@/lib/web-notifications'

// ── Types ────────────────────────────────────────────────────────────────────
export interface LineSource { type: string; userId: string; groupId?: string }
export interface LineMessage { type: string; text?: string; id: string }
export interface LineEvent {
  type: string
  source: LineSource
  message: LineMessage
  replyToken?: string
}

// ── ตัวประมวลผล event หลัก — ใช้ร่วมกันทั้งบัญชี default และบัญชี OA อื่นๆ ────
// oaAccountId: undefined = บัญชี default (ทำงานเหมือนเดิมก่อนมี multi-OA)
export async function processWebhookEvents(events: LineEvent[], oaAccountId?: string) {
  for (const event of events) {
    // ── กันประมวลผลซ้ำ ──────────────────────────────────────────────────────
    // LINE จะส่ง webhook เดิมซ้ำอัตโนมัติถ้าเซิร์ฟเวอร์เราตอบกลับช้าเกินไปหรือ error
    // ทำให้ event เดียวกันถูกประมวลผล 2 รอบขึ้นไป (ข้อความอัตโนมัติ/บันทึกข้อมูลซ้ำ)
    // เช็คด้วย message.id (มีเฉพาะ event ประเภท message) — ลองบันทึกก่อน ถ้าเคยมีอยู่แล้ว
    // (ชน unique constraint) แปลว่าเคยประมวลผลไปแล้ว ข้ามได้เลยไม่ต้องทำซ้ำ
    if (event.type === 'message' && event.message?.id) {
      const { error: dupError } = await supabaseAdmin
        .from('line_processed_messages').insert({ message_id: event.message.id })
      if (dupError) {
        console.log('[LINE] ข้าม event ซ้ำ (LINE ส่ง webhook ซ้ำ):', event.message.id)
        continue
      }
    }

    // ── Follow event: ลูกค้าหรือช่าง follow OA ──────────────────────────────
    // LINE ฝั่งลูกค้า "เงียบสนิท" ไม่ส่งข้อความอะไรทั้งนั้น (ไม่มีให้พิมพ์เบอร์โทร ไม่มีข้อความต้อนรับ)
    // แต่แจ้งเตือนเข้าเว็บ (กระดิ่งมุมขวาบน) ให้แอดมินรู้ทันทีว่ามีคนแอดเพื่อนเข้ามา
    if (event.type === 'follow') {
      const uid = event.source.userId
      console.log('[LINE] New follow:', uid, oaAccountId ? `(oa=${oaAccountId})` : '')
      await recordSeenContact({ kind: 'user', lineId: uid, oaAccountId })
      await notifyNewFollowerToWeb(uid)
    }

    // ── Join group event: OA ถูกเพิ่มเข้า group ──────────────────────────────
    if (event.type === 'join' && event.source.type === 'group') {
      const gid = event.source.groupId!
      console.log('[LINE] Joined group:', gid, oaAccountId ? `(oa=${oaAccountId})` : '')

      const isDuplicateJoin = await wasSeenRecently(gid, 3)
      await recordSeenContact({ kind: 'group', lineId: gid, oaAccountId })

      if (!isDuplicateJoin) {
        await sendGroupMessage(gid, [{
          type: 'text',
          text: '🪟 สวัสดีค่ะ ร้านผ้าม่านเชื่อมระบบแจ้งหนี้กับ LINE กลุ่มนี้แล้ว\n\nเมื่อสร้าง Invoice ระบบจะส่งยอดมาที่นี่อัตโนมัติ\nพิมพ์ "โอนแล้ว" หรือส่งสลิปเพื่อยืนยันการชำระค่ะ 💚',
        }], oaAccountId)
      }
    }

    // ── Message event: ตรวจหา keyword ชำระเงิน ──────────────────────────────
    if (event.type === 'message' && event.message.type === 'text') {
      const text: string = event.message.text || ''
      const userId: string = event.source.userId
      const groupId: string | undefined = event.source.groupId

      await recordSeenContact({ kind: 'user', lineId: userId, oaAccountId, lastMessage: text })
      if (groupId) await recordSeenContact({ kind: 'group', lineId: groupId, oaAccountId })

      if (groupId) {
        console.log('[LINE] Group message from:', userId, '| text:', text)
        const isBot = await isRegisteredPaymentBot(userId)
        if (isBot) {
          await handleBotPaymentConfirm({ groupId, userId, note: text, oaAccountId })
        } else {
          await handleGroupMessage({ text, userId, groupId, oaAccountId })
        }
      } else {
        // DM — ช่างรับงานผ่าน command / ลูกค้าผูกบัญชีด้วยเบอร์โทร
        await handleDM({ text, userId, oaAccountId })
      }
    }

    // ── Image message: ตรวจสลิปใน group ────────────────────────────────────
    if (event.type === 'message' && event.message.type === 'image') {
      const groupId: string | undefined = event.source.groupId
      const userId: string = event.source.userId
      await recordSeenContact({ kind: 'user', lineId: userId, oaAccountId, lastMessage: '📷 [รูปภาพ]' })
      if (groupId) await recordSeenContact({ kind: 'group', lineId: groupId, oaAccountId })
      if (groupId) {
        const isBot = await isRegisteredPaymentBot(userId)
        if (isBot) {
          await handleBotPaymentConfirm({ groupId, userId, note: 'ส่งรูปยืนยันการโอน', oaAccountId })
        } else {
          await handleSlipImage({ groupId, userId, messageId: event.message.id, oaAccountId })
        }
      } else {
        // ลูกค้าส่งสลิปมาทาง DM โดยตรง — ไม่ต้องมี LINE Group เลย
        await handleSlipImageDM({ userId, messageId: event.message.id, oaAccountId })
      }
    }
  }
}

// ── เช็คว่าเพิ่งเห็น userId/groupId นี้ในไม่กี่นาทีที่ผ่านมาไหม — กัน LINE ส่ง event ซ้ำ ──
async function wasSeenRecently(lineId: string, withinMinutes: number): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('line_seen_contacts').select('last_seen_at').eq('line_id', lineId).maybeSingle()
  if (!data?.last_seen_at) return false
  const diffMin = (Date.now() - new Date(data.last_seen_at).getTime()) / 60000
  return diffMin <= withinMinutes
}

// ── แอดเพื่อนแล้ว: เช็คว่าเป็นลูกค้าเดิม / ช่างอยู่แล้วไหม ถ้ายังไม่ใช่ทั้งคู่ ─────
// ให้ "สร้างลูกค้าใหม่อัตโนมัติ" ผูก line_user_id ให้เลย จะได้เห็นในเมนูลูกค้า
// และเลือกได้ตอนจัดคิวช่างทันที ไม่ต้องรอผูกเองทีหลัง
async function notifyNewFollowerToWeb(uid: string) {
  const { data: existingCustomer } = await supabaseAdmin
    .from('customers').select('id,name').eq('line_user_id', uid).maybeSingle()

  if (existingCustomer) {
    await createWebNotification({
      type: 'new_follower',
      title: '👋 ลูกค้าเก่ากลับมาแอดเพื่อน LINE OA อีกครั้ง',
      message: `${existingCustomer.name} · userId: ${uid}`,
      link: `/customers/${existingCustomer.id}`,
    })
    return
  }

  // เป็นช่างอยู่แล้ว (ผูก line_user_id ไว้ในตาราง technicians) ไม่ต้องสร้างลูกค้าซ้ำ
  const { data: existingTechnician } = await supabaseAdmin
    .from('technicians').select('id,name').eq('line_user_id', uid).maybeSingle()
  if (existingTechnician) return

  // ดึงชื่อที่ระบบเพิ่งบันทึกไว้ตอน recordSeenContact มาใช้ตั้งชื่อลูกค้าใหม่
  const { data: seen } = await supabaseAdmin
    .from('line_seen_contacts').select('display_name').eq('line_id', uid).maybeSingle()
  const autoName = seen?.display_name || 'ลูกค้าใหม่ (LINE)'

  const { data: newCustomer } = await supabaseAdmin
    .from('customers')
    .insert({
      name: autoName, phone: '', address: '', line_user_id: uid,
      notes: 'สร้างอัตโนมัติจากการแอดเพื่อน LINE OA — ยังไม่มีเบอร์โทร/ที่อยู่ กรุณากรอกเพิ่มเติม',
    })
    .select('id,name').single()

  await createWebNotification({
    type: 'new_follower',
    title: '👋 มีคนแอดเพื่อน LINE OA ใหม่ (สร้างลูกค้าอัตโนมัติแล้ว)',
    message: `${newCustomer?.name || autoName} · ยังไม่มีเบอร์โทร/ที่อยู่ — กดเพื่อกรอกเพิ่มเติม`,
    link: newCustomer ? `/customers/${newCustomer.id}` : '/customers',
  })
}

// ── ช่องทางที่ 4: ยืนยันชำระเงินจากบอทธนาคาร (เช่น @ขุนทอง) ────────────────────
async function isRegisteredPaymentBot(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('payment_bot_accounts').select('id').eq('line_user_id', userId).eq('active', true).maybeSingle()
  return !!data
}

async function handleBotPaymentConfirm(opts: { groupId: string; userId: string; note: string; oaAccountId?: string }) {
  const { groupId, note, oaAccountId } = opts

  const { data: gs } = await supabaseAdmin
    .from('line_group_settings').select('customer_id').eq('group_id', groupId).single()
  if (!gs) return

  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('*, customer:customers(name)')
    .eq('customer_id', gs.customer_id)
    .in('status', ['unpaid', 'partial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!inv) return

  await supabaseAdmin.from('invoices').update({
    status: 'paid',
    paid_amount: inv.total,
    paid_at: new Date().toISOString(),
  }).eq('id', inv.id)

  await supabaseAdmin.from('invoice_group_messages').update({
    confirmed_at: new Date().toISOString(),
    confirmed_by: 'khunthong_bot',
  }).eq('invoice_id', inv.id).eq('group_id', groupId)

  await supabaseAdmin.from('payment_logs').insert({
    invoice_id: inv.id,
    amount: inv.total - (inv.paid_amount || 0),
    method: 'khunthong_bot',
    note: `ยืนยันโดยขุนทอง: "${note}"`,
    confirmed_by: 'khunthong_bot',
  })

  await sendGroupMessage(groupId, [{
    type: 'text',
    text: `✅ ระบบได้รับการยืนยันจากขุนทองแล้วค่ะ!\n\nInvoice ${inv.invoice_no}\nยอด ฿${(inv.total || 0).toLocaleString()} บาท ชำระเรียบร้อย\nขอบคุณที่ใช้บริการนะคะ 🙏`,
  }], oaAccountId)

  const custName = (inv as unknown as { customer?: { name?: string } }).customer?.name || 'ลูกค้า'
  const paidText = `💰 รับชำระเงินแล้ว\n\nลูกค้า: ${custName}\nInvoice: ${inv.invoice_no}\nยอด: ฿${(inv.total || 0).toLocaleString()}\nยืนยันผ่าน: 🏦 ขุนทอง (KBank)`
  await notifyAccountingAndManagement(paidText)
  await notifyEventGroups('payment_confirmed', paidText)
}

// ── Handle group text message ─────────────────────────────────────────────────
async function handleGroupMessage(opts: {
  text: string; userId: string; groupId: string; oaAccountId?: string
}) {
  const { text, userId, groupId, oaAccountId } = opts

  const { data: kws } = await supabaseAdmin
    .from('payment_keywords').select('keyword').eq('active', true)
  const keywords = (kws || []).map(k => k.keyword)

  if (!isPaymentConfirmKeyword(text, keywords)) return

  const { data: gs } = await supabaseAdmin
    .from('line_group_settings').select('customer_id').eq('group_id', groupId).single()
  if (!gs) return

  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('*, customer:customers(name)')
    .eq('customer_id', gs.customer_id)
    .in('status', ['unpaid', 'partial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!inv) return

  await supabaseAdmin.from('invoices').update({
    status: 'paid',
    paid_amount: inv.total,
    paid_at: new Date().toISOString(),
  }).eq('id', inv.id)

  await supabaseAdmin.from('invoice_group_messages').update({
    confirmed_at: new Date().toISOString(),
    confirmed_by: userId,
  }).eq('invoice_id', inv.id).eq('group_id', groupId)

  await supabaseAdmin.from('payment_logs').insert({
    invoice_id: inv.id,
    amount: inv.total - (inv.paid_amount || 0),
    method: 'line_confirm',
    note: `ยืนยันผ่าน LINE group: "${text}"`,
    confirmed_by: userId,
  })

  const custName = (inv as unknown as { customer?: { name?: string } }).customer?.name || 'ลูกค้า'
  const paidText = `💰 รับชำระเงินแล้ว\n\nลูกค้า: ${custName}\nInvoice: ${inv.invoice_no}\nยอด: ฿${(inv.total || 0).toLocaleString()}\nยืนยันผ่าน: LINE Group ("${text}")`
  await notifyAccountingAndManagement(paidText)
  await notifyEventGroups('payment_confirmed', paidText)

  await sendGroupMessage(groupId, [{
    type: 'text',
    text: `✅ รับทราบค่ะ!\n\nยืนยันการชำระ Invoice ${inv.invoice_no}\nยอด ฿${(inv.total || 0).toLocaleString()} บาท\nขอบคุณที่ใช้บริการนะคะ 🙏`,
  }], oaAccountId)
}

// ── Handle slip image in group ────────────────────────────────────────────────
async function handleSlipImage(opts: { groupId: string; userId: string; messageId: string; oaAccountId?: string }) {
  const { groupId, userId, messageId, oaAccountId } = opts

  const { data: gs } = await supabaseAdmin
    .from('line_group_settings').select('customer_id').eq('group_id', groupId).single()
  if (!gs) return

  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('*, customer:customers(name)')
    .eq('customer_id', gs.customer_id)
    .in('status', ['unpaid', 'partial'])
    .order('created_at', { ascending: false })
    .limit(1).single()
  if (!inv) return

  // ดึงรูปสลิปจาก Line API — ต้องใช้ token ของ OA บัญชีเดียวกับที่รับ webhook นี้
  const { getLineOACredentials } = await import('@/lib/line-config')
  const { token: slipToken } = await getLineOACredentials(oaAccountId)
  const imageRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${slipToken}` },
  })

  let slipUrl: string | undefined
  if (imageRes.ok) {
    const buf = await imageRes.arrayBuffer()
    const path = `slips/${inv.id}/${Date.now()}.jpg`
    const { data: uploaded } = await supabaseAdmin.storage
      .from('job-photos').upload(path, Buffer.from(buf), { contentType: 'image/jpeg', upsert: true })
    if (uploaded) {
      const { data: { publicUrl } } = supabaseAdmin.storage.from('job-photos').getPublicUrl(path)
      slipUrl = publicUrl
    }
  }

  await supabaseAdmin.from('invoices').update({
    status: 'paid',
    paid_amount: inv.total,
    paid_at: new Date().toISOString(),
    slip_url: slipUrl,
  }).eq('id', inv.id)

  await supabaseAdmin.from('payment_logs').insert({
    invoice_id: inv.id,
    amount: inv.total - (inv.paid_amount || 0),
    method: 'slip',
    slip_url: slipUrl,
    confirmed_by: userId,
  })

  await sendGroupMessage(groupId, [{
    type: 'text',
    text: `✅ ได้รับสลิปแล้วค่ะ!\n\nยืนยันการชำระ Invoice ${inv.invoice_no}\nยอด ฿${(inv.total || 0).toLocaleString()} บาท\nขอบคุณมากค่ะ 🙏`,
  }], oaAccountId)

  const custName = (inv as unknown as { customer?: { name?: string } }).customer?.name || 'ลูกค้า'
  const paidText = `💰 รับชำระเงินแล้ว\n\nลูกค้า: ${custName}\nInvoice: ${inv.invoice_no}\nยอด: ฿${(inv.total || 0).toLocaleString()}\nยืนยันผ่าน: สลิปโอนเงิน`
  await notifyAccountingAndManagement(paidText)
  await notifyEventGroups('payment_confirmed', paidText)
}

// ── ยืนยันการชำระเงินด้วยสลิปที่ลูกค้าส่งมาทาง DM ตรงๆ — ไม่ต้องมี LINE Group ────
// (ขุนทองยังต้องผ่านกลุ่มอยู่ เพราะ OA คุยกับ OA แบบ 1:1 ไม่ได้ นี่คือทางเลือกให้ลูกค้ายืนยันเอง)
async function handleSlipImageDM(opts: { userId: string; messageId: string; oaAccountId?: string }) {
  const { userId, messageId, oaAccountId } = opts

  const { data: customer } = await supabaseAdmin
    .from('customers').select('id, name').eq('line_user_id', userId).maybeSingle()
  if (!customer) return // ยังไม่ผูกบัญชีลูกค้า (ต้องพิมพ์เบอร์โทรผูกก่อน) ไม่รู้ว่าเป็นใคร เลยข้าม

  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('*, customer:customers(name)')
    .eq('customer_id', customer.id)
    .in('status', ['unpaid', 'partial'])
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  if (!inv) {
    // ไม่พบ invoice ค้างชำระ — ไม่ต้องตอบอะไรกลับไปแล้ว เพราะรูปที่ส่งมาอาจไม่ใช่สลิปเลยก็ได้
    // (เจอปัญหาว่าลูกค้าส่งรูปหน้างานทั่วไป/คุยเรื่องอื่น แล้วดันได้รับข้อความ "ไม่พบรายการค้างชำระ" งงว่าทำไม)
    // ปล่อยให้แชทคุยกับ OA ได้ตามปกติ ไม่มีบอทมาแทรก
    return
  }

  const { getLineOACredentials } = await import('@/lib/line-config')
  const { token: slipToken } = await getLineOACredentials(oaAccountId)
  const imageRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${slipToken}` },
  })

  let slipUrl: string | undefined
  if (imageRes.ok) {
    const buf = await imageRes.arrayBuffer()
    const path = `slips/${inv.id}/${Date.now()}.jpg`
    const { data: uploaded } = await supabaseAdmin.storage
      .from('job-photos').upload(path, Buffer.from(buf), { contentType: 'image/jpeg', upsert: true })
    if (uploaded) {
      const { data: { publicUrl } } = supabaseAdmin.storage.from('job-photos').getPublicUrl(path)
      slipUrl = publicUrl
    }
  }

  await supabaseAdmin.from('invoices').update({
    status: 'paid', paid_amount: inv.total, paid_at: new Date().toISOString(), slip_url: slipUrl,
  }).eq('id', inv.id)

  await supabaseAdmin.from('payment_logs').insert({
    invoice_id: inv.id, amount: inv.total - (inv.paid_amount || 0),
    method: 'slip_dm', slip_url: slipUrl, confirmed_by: userId,
  })

  // ไม่ตอบกลับลูกค้าอัตโนมัติแล้ว (ตามที่แจ้ง) — แต่ยังแจ้งฝั่งบัญชี/ผู้บริหารเหมือนเดิม เพื่อให้รู้ว่ามีคนโอนเงินมา
  const paidText = `💰 รับชำระเงินแล้ว\n\nลูกค้า: ${customer.name}\nInvoice: ${inv.invoice_no}\nยอด: ฿${(inv.total || 0).toLocaleString()}\nยืนยันผ่าน: สลิปโอนเงิน (DM ลูกค้าโดยตรง ไม่ผ่านกลุ่ม)`
  await notifyAccountingAndManagement(paidText)
  await notifyEventGroups('payment_confirmed', paidText)
}

// ── Handle DM (ช่างรับ/ปิดงาน ผ่าน command, ลูกค้าผูกบัญชีด้วยเบอร์โทร) ──────────

async function handleDM(opts: { text: string; userId: string; oaAccountId?: string }) {
  const { text, userId, oaAccountId } = opts
  const t = text.trim().toLowerCase()

  if (t.startsWith('รับงาน:') || t.startsWith('accept:')) {
    const jobId = text.replace(/^(รับงาน:|accept:)/i, '').trim()
    await supabaseAdmin.from('jobs').update({
      status: 'in_progress', accepted_at: new Date().toISOString(),
    }).eq('id', jobId).eq('technician_id',
      (await supabaseAdmin.from('technicians').select('id').eq('line_user_id', userId).single()).data?.id || ''
    )
    return
  }

  // ── ลูกค้าพิมพ์ยืนยันการชำระเงินมาทาง DM ตรงๆ — ไม่ต้องมี LINE Group ─────────
  // (ขุนทองยังยืนยันผ่านกลุ่มเท่านั้น นี่คือให้ลูกค้ายืนยันเองแทน)
  const { data: kws } = await supabaseAdmin.from('payment_keywords').select('keyword').eq('active', true)
  const keywords = (kws || []).map(k => k.keyword)
  if (isPaymentConfirmKeyword(text, keywords)) {
    const { data: customer } = await supabaseAdmin
      .from('customers').select('id, name').eq('line_user_id', userId).maybeSingle()

    // ไม่ตอบกลับลูกค้าอัตโนมัติแล้วในทุกกรณี (ตามที่แจ้ง) — แค่ประมวลผลเงียบๆ เบื้องหลัง
    // เหตุผล: ข้อความทั่วไปที่ไม่เกี่ยวกับการชำระเงินเลยดันไปตรงกับคำที่ตั้งไว้แบบ substring match
    // แล้วลูกค้าได้รับข้อความ "ไม่พบรายการค้างชำระ" ที่งงว่าทำไมถึงตอบแบบนั้น
    if (!customer) return

    const { data: inv } = await supabaseAdmin
      .from('invoices')
      .select('*, customer:customers(name)')
      .eq('customer_id', customer.id)
      .in('status', ['unpaid', 'partial'])
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()

    if (!inv) return

    await supabaseAdmin.from('invoices').update({
      status: 'paid', paid_amount: inv.total, paid_at: new Date().toISOString(),
    }).eq('id', inv.id)

    await supabaseAdmin.from('payment_logs').insert({
      invoice_id: inv.id, amount: inv.total - (inv.paid_amount || 0),
      method: 'line_dm_confirm', note: `ยืนยันผ่าน DM ลูกค้า: "${text}"`, confirmed_by: userId,
    })

    const paidText = `💰 รับชำระเงินแล้ว\n\nลูกค้า: ${customer.name}\nInvoice: ${inv.invoice_no}\nยอด: ฿${(inv.total || 0).toLocaleString()}\nยืนยันผ่าน: DM ลูกค้าโดยตรง ("${text}") — ไม่ผ่านกลุ่ม`
    await notifyAccountingAndManagement(paidText)
    await notifyEventGroups('payment_confirmed', paidText)
    return
  }

  // ── พิมพ์เบอร์โทรมาเพื่อผูกบัญชี LINE กับ "ลูกค้า" หรือ "ช่าง" ที่มีอยู่แล้ว ──
  // เช็คลูกค้าก่อน ถ้าไม่เจอค่อยเช็คช่าง (เบอร์ซ้ำกันระหว่างสองตารางแทบเป็นไปไม่ได้)
  // หมายเหตุ: ผูกบัญชีให้เงียบๆ ไม่ตอบยืนยันกลับไปแล้ว (ตามที่แจ้ง) — เช็คผลว่าผูกสำเร็จหรือยัง
  // ได้จากหน้า Settings → คนที่เคยทัก LINE OA เข้ามา แทน
  const looksLikePhone = /^[\d\s\-()]+$/.test(text.trim())
  const digits = text.replace(/\D/g, '')
  if (looksLikePhone && (digits.length === 9 || digits.length === 10)) {
    const { data: customer } = await supabaseAdmin
      .from('customers').select('id, name, line_user_id').eq('phone', digits).maybeSingle()

    if (customer) {
      if (customer.line_user_id === userId) return
      await supabaseAdmin.from('customers').update({ line_user_id: userId, oa_account_id: oaAccountId || null }).eq('id', customer.id)
      await clearDuplicateLineUserId('customers', userId, customer.id)
      return
    }

    const { data: technician } = await supabaseAdmin
      .from('technicians').select('id, name, line_user_id').eq('phone', digits).eq('status', 'active').maybeSingle()

    if (technician) {
      if (technician.line_user_id === userId) return
      await supabaseAdmin.from('technicians').update({ line_user_id: userId, oa_account_id: oaAccountId || null }).eq('id', technician.id)
      await clearDuplicateLineUserId('technicians', userId, technician.id)
      // เผื่อระบบ auto-create เป็น "ลูกค้า" ให้ผิดตอน follow event (เพราะตอนนั้นยังไม่รู้ว่าเป็นช่าง) — เคลียร์ทิ้งด้วย
      await clearDuplicateLineUserId('customers', userId)
      return
    }
    // ไม่เจอเบอร์นี้ในระบบ — ไม่ตอบอะไรกลับไปแล้วเช่นกัน
  }
}

// ── เคลียร์ userId ออกจาก record อื่นที่บังเอิญถือ userId เดียวกันอยู่ก่อน ──────
// เกิดได้เวลาระบบ auto-create ลูกค้า/ช่างใหม่ตอน follow event ไปแล้ว แต่คนนั้นพิมพ์
// เบอร์โทรตามมาทีหลังเพื่อผูกกับ record เดิมที่มีประวัติงานอยู่ — กันไม่ให้ 2 record
// ถือ line_user_id เดียวกัน (ทำให้ query ที่คาด row เดียวพังได้)
async function clearDuplicateLineUserId(table: 'customers' | 'technicians', lineUserId: string, keepId?: string) {
  let query = supabaseAdmin.from(table).select('id').eq('line_user_id', lineUserId)
  if (keepId) query = query.neq('id', keepId)
  const { data: dups } = await query
  if (!dups || dups.length === 0) return

  const dupIds = dups.map(d => d.id)
  const clearBody: Record<string, unknown> = { line_user_id: null }
  if (table === 'technicians') clearBody.status = 'inactive'
  await supabaseAdmin.from(table).update(clearBody).in('id', dupIds)
}
