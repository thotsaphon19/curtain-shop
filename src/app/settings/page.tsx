import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import GroupSettingsForm from './GroupSettingsForm'
import KeywordSettingsForm from './KeywordSettingsForm'
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const [groupsRes, customersRes, keywordsRes] = await Promise.all([
    supabaseAdmin.from('line_group_settings')
      .select('*, customer:customers(name,phone)').order('created_at', { ascending: false }),
    supabaseAdmin.from('customers').select('id,name,phone').order('name'),
    supabaseAdmin.from('payment_keywords').select('*').order('keyword'),
  ])

  return (
    <AppLayout user={session}>
      <div style={{ maxWidth: 760 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: '#0F2027' }}>⚙️ ตั้งค่าระบบ</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 28px' }}>
          เชื่อมต่อ LINE Group กับขุนทอง และตั้งค่า keyword ยืนยันชำระ
        </p>

        {/* KhunThong Guide */}
        <div style={{
          background: 'linear-gradient(135deg, #E1F5EE 0%, #E6F1FB 100%)',
          border: '1px solid #9FE1CB', borderRadius: 14, padding: '18px 20px', marginBottom: 28,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0F2027', marginBottom: 10 }}>
            🏦 วิธีเชื่อมกับขุนทอง (KBank)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            {[
              { step: '1', text: 'สร้าง LINE Group กับลูกค้า', color: '#0F6E56' },
              { step: '2', text: 'แอด LINE OA ร้านเข้า group', color: '#0F6E56' },
              { step: '3', text: 'แอด @ขุนทอง เข้า group เดียวกัน', color: '#854F0B' },
              { step: '4', text: 'คัดลอก Group ID มาใส่ด้านล่าง', color: '#185FA5' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  minWidth: 24, height: 24, borderRadius: '50%', background: s.color,
                  color: '#fff', fontSize: 12, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{s.step}</div>
                <div style={{ fontSize: 13, color: '#333', paddingTop: 3 }}>{s.text}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.7)', borderRadius: 8, fontSize: 12, color: '#555' }}>
            💡 <strong>วิธีหา Group ID:</strong> เพิ่ม LINE OA เข้า group → ระบบจะรับ webhook พร้อม groupId อัตโนมัติ
            หรือดูได้จาก LINE Developers Console → Webhook logs
          </div>
        </div>

        {/* Group Settings */}
        <GroupSettingsForm
          groups={groupsRes.data || []}
          customers={customersRes.data || []}
        />

        {/* Keyword Settings */}
        <KeywordSettingsForm keywords={keywordsRes.data || []} />
      </div>
    </AppLayout>
  )
}
