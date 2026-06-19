import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import ReminderConfigForm from './ReminderConfigForm'
export const dynamic = 'force-dynamic'

export default async function PaymentSettingsPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const { data: configs } = await supabaseAdmin
    .from('payment_reminder_configs').select('*').order('days_after')

  return (
    <AppLayout user={session}>
      <div style={{ maxWidth: 680 }}>
        <div style={{ marginBottom: 24 }}>
          <a href="/payments" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← กลับ</a>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '8px 0 4px', color: '#0F2027' }}>
            ⚙️ ตั้งค่าแจ้งเตือนการชำระเงิน
          </h1>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>กำหนดวัน เวลา และข้อความแจ้งเตือนอัตโนมัติผ่าน Line OA</p>
        </div>
        <ReminderConfigForm configs={configs || []} />
      </div>
    </AppLayout>
  )
}
