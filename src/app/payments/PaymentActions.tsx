'use client'
import { useState } from 'react'

export default function PaymentActions({ invoiceId, customerLineId, invoiceNo, amount, customerName }: {
  invoiceId: string; customerLineId: string; invoiceNo: string; amount: number; customerName: string
}) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function sendReminder() {
    setSending(true)
    try {
      const res = await fetch('/api/payments/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId, customer_line_id: customerLineId, invoice_no: invoiceNo, amount, customer_name: customerName }),
      })
      if (res.ok) setSent(true)
    } finally { setSending(false) }
  }

  if (sent) return <span style={{ fontSize: 12, color: '#3B6D11', fontWeight: 600 }}>✅ ส่งแล้ว</span>

  return (
    <button onClick={sendReminder} disabled={sending} style={{
      fontSize: 12, background: '#06C755', color: '#fff',
      padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600,
      opacity: sending ? 0.6 : 1,
    }}>
      {sending ? '...' : '💬 แจ้ง'}
    </button>
  )
}
