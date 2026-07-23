import { supabaseAdmin } from './supabase'
import { buildInvoiceText, notifyInvoiceToCustomer, sendInvoiceTextToGroup, notifyAccountingAndManagement, notifyEventGroups } from './line'

export function generateInvoiceNo() {
  return `INV${new Date().getFullYear()}${String(Date.now()).slice(-6)}`
}

// เรียกเมื่อช่างปิดงาน (status -> completed) — สร้าง Invoice งานติดตั้ง (ไม่มีรายการสินค้า)
// และส่งให้ลูกค้าทันทีทาง LINE (DM + กลุ่มที่มีขุนทองถ้ามีการตั้งค่าไว้)
export async function createAndSendInstallationInvoiceForJob(job: {
  id: string
  title: string
  amount?: number | null
  deposit_amount?: number | null
  vat_amount?: number | null
  has_invoice_no?: boolean | null
  invoice_no?: string | null
  bank_account?: string | null
  qr_code_url?: string | null
  customer_id: string
  customer?: { id: string; name: string; line_user_id?: string | null } | null
}) {
  // ถ้ามี Invoice ของงานนี้อยู่แล้ว ไม่ต้องสร้างซ้ำ
  const { data: existing } = await supabaseAdmin
    .from('invoices').select('id').eq('job_id', job.id).maybeSingle()
  if (existing) return { invoice: existing, created: false }

  const amount = job.amount || 0
  const vat = job.vat_amount || 0
  const total = amount + vat
  const deposit = job.deposit_amount || 0
  // ใช้เลขที่ Invoice ที่แอดมินระบุไว้ตอนสร้างงาน ถ้าไม่ได้ระบุก็สร้างให้อัตโนมัติเหมือนเดิม
  const invoice_no = (job.has_invoice_no && job.invoice_no?.trim()) ? job.invoice_no.trim() : generateInvoiceNo()
  const dueDate = new Date().toISOString().slice(0, 10) // ครบกำหนดวันนี้ (งานติดตั้งเก็บเงินปลายทาง)

  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .insert({
      invoice_no,
      customer_id: job.customer_id,
      job_id: job.id,
      invoice_type: 'installation',
      subtotal: amount,
      discount: 0,
      vat_pct: 0,
      vat_amount: job.vat_amount ?? null,
      total,
      paid_amount: deposit, // ยอดมัดจำที่รับไว้ก่อนหน้า → ให้ "ยอดคงเหลือ" ในใบแจ้งหนี้คำนวณถูกต้องอัตโนมัติ
      due_date: dueDate,
      bank_account: job.bank_account || null,
      qr_code_url: job.qr_code_url || null,
      notes: job.title,
      status: deposit >= total && total > 0 ? 'paid' : deposit > 0 ? 'partial' : 'unpaid',
    })
    .select().single()

  if (error || !invoice) return { invoice: null, created: false, error: error?.message }

  await sendInstallationInvoice(invoice.id)

  return { invoice, created: true }
}

// ส่ง Invoice (text) ให้ลูกค้าทาง LINE DM และเข้ากลุ่ม (ถ้าตั้งค่าไว้ + auto_send เปิดอยู่)
export async function sendInstallationInvoice(invoiceId: string) {
  const { data: inv } = await supabaseAdmin
    .from('invoices').select('*, customer:customers(*), job:jobs(title)').eq('id', invoiceId).single()
  if (!inv) return { success: false, error: 'Invoice not found' }

  const cust = (inv as unknown as { customer: { id: string; name: string; line_user_id?: string } }).customer
  const job = (inv as unknown as { job?: { title?: string } }).job

  const { data: templates } = await supabaseAdmin
    .from('invoice_field_templates').select('field_key,label').eq('active', true)
  const fieldLabels = Object.fromEntries((templates || []).map(t => [t.field_key, t.label]))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const text = buildInvoiceText({
    invoiceNo: inv.invoice_no,
    customerName: cust?.name || '',
    jobTitle: job?.title,
    amount: inv.total || 0,
    paidAmount: inv.paid_amount || 0,
    vatAmount: inv.vat_amount ?? null,
    dueDate: inv.due_date,
    bankAccount: inv.bank_account,
    qrCodeUrl: inv.qr_code_url,
    customFields: (inv.custom_fields as Record<string, string>) || {},
    fieldLabels,
    invoiceUrl: appUrl ? `${appUrl}/invoices/${invoiceId}` : undefined,
  })

  const channels: string[] = []

  if (cust?.line_user_id) {
    const r = await notifyInvoiceToCustomer({
      job_id: inv.job_id || undefined,
      invoice_id: invoiceId,
      customer_line_id: cust.line_user_id,
      text,
    })
    if (r.success) channels.push('line_dm')
  }

  if (cust?.id) {
    const { data: gs } = await supabaseAdmin
      .from('line_group_settings').select('*').eq('customer_id', cust.id).maybeSingle()
    if (gs && gs.auto_send) {
      const r = await sendInvoiceTextToGroup(gs.group_id, text)
      if (r.success) {
        channels.push('line_group')
        await supabaseAdmin.from('invoice_group_messages').insert({
          invoice_id: invoiceId,
          group_id: gs.group_id,
          message_id: (r as { messageId?: string }).messageId,
        })
      }
    }
  }

  await supabaseAdmin.from('invoices').update({
    sent_at: new Date().toISOString(),
    sent_channel: channels.join('+') || null,
  }).eq('id', invoiceId)

  const invoiceSentText = `🧾 งานเสร็จสิ้น + ส่ง Invoice แล้ว\n\nลูกค้า: ${cust?.name || '-'}\nInvoice: ${inv.invoice_no}\nยอด: ฿${(inv.total || 0).toLocaleString()}\nสถานะ: รอชำระ`
  await notifyAccountingAndManagement(invoiceSentText)
  await notifyEventGroups('invoice_sent', invoiceSentText)

  return { success: channels.length > 0, channels }
}
