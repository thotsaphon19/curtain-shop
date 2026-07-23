import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import GroupSettingsForm from './GroupSettingsForm'
import KeywordSettingsForm from './KeywordSettingsForm'
import InternalGroupsSettings from './InternalGroupsSettings'
import NotifyAccountsSettings from './NotifyAccountsSettings'
import InvoiceFieldSettingsForm from './InvoiceFieldSettingsForm'
import PaymentBotSettingsForm from './PaymentBotSettingsForm'
import LineOASettingsForm from './LineOASettingsForm'
import LineLoginSettingsForm from './LineLoginSettingsForm'
import LineOAAccountsSettings from './LineOAAccountsSettings'
import LineSeenContactsSettings from './LineSeenContactsSettings'
import OAMigrationSettings from './OAMigrationSettings'
import DailyNotificationTimeSettings from './DailyNotificationTimeSettings'
import BankAccountsSettings from './BankAccountsSettings'
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const [groupsRes, customersRes, keywordsRes, internalGroupsRes, notifyAccountsRes, invoiceFieldsRes, paymentBotsRes] = await Promise.all([
    supabaseAdmin.from('line_group_settings')
      .select('*, customer:customers(name,phone)').order('created_at', { ascending: false }),
    supabaseAdmin.from('customers').select('id,name,phone').order('name'),
    supabaseAdmin.from('payment_keywords').select('*').order('keyword'),
    supabaseAdmin.from('internal_line_groups').select('*').order('group_type').order('created_at'),
    supabaseAdmin.from('notify_accounts').select('*').order('account_type').order('created_at'),
    supabaseAdmin.from('invoice_field_templates').select('*').order('sort_order', { ascending: true }),
    supabaseAdmin.from('payment_bot_accounts').select('*').order('created_at', { ascending: false }),
  ])

  return (
    <AppLayout user={session}>
      <div style={{ maxWidth: 860 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: 'var(--dark)' }}>⚙️ ตั้งค่าระบบ</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 28px' }}>
          ตั้งค่าทั้งหมดในที่เดียว — บันทึกลงฐานข้อมูล ใช้งานได้ทันที ไม่ต้องแตะ env
        </p>

        {/* ─── 0. เชื่อมต่อ LINE OA ────────────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>🔌</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>เชื่อมต่อ LINE OA</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ต้องตั้งค่านี้ก่อน ฟีเจอร์แจ้งเตือน LINE อื่นๆ ทั้งหมดถึงจะทำงานได้
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
          <LineOASettingsForm />
        </div>

        {/* ─── 0.3 เชื่อมต่อ LINE Login ────────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>🔑</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>เชื่อมต่อ LINE Login</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ใช้สำหรับให้ลูกค้า/ช่าง/แอดมิน ล็อกอินเข้าระบบด้วย LINE — ตั้งค่าที่นี่ ไม่ต้องแก้ env ใน Vercel
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
          <LineLoginSettingsForm />
        </div>

        {/* ─── 0.5 บัญชี LINE OA หลายบัญชี (Multi-OA) ────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>📡</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>บัญชี LINE OA หลายบัญชี</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                มีหลาย OA (เช่น xxxx, xxxx)? เพิ่มที่นี่ แล้วเลือกได้ว่ากลุ่มไหนส่งผ่านบัญชีไหน
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
          <LineOAAccountsSettings />
        </div>

        {/* ─── 0.6 ย้ายลูกค้า/ช่างไป OA ใหม่ ──────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>📣</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>ย้ายลูกค้า/ช่างไป OA ใหม่</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                เปลี่ยน OA แล้ว? ส่งคำเชิญให้ทุกคนแอดเพื่อน OA ใหม่พร้อมกันทีเดียว
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
          <OAMigrationSettings />
        </div>

        <DailyNotificationTimeSettings />
        <BankAccountsSettings />

        {/* ─── 0.7 คนและกลุ่มที่เคยทัก LINE OA เข้ามา ─────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>🪪</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>คนและกลุ่มที่เคยทัก LINE OA เข้ามา</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                คัดลอก userId / groupId ไปใช้ตั้งค่าส่วนอื่นได้เลย ไม่ต้องเข้า Vercel Logs
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
          <LineSeenContactsSettings />
        </div>

        {/* ─── 1. LINE กลุ่มช่าง + ฝ่ายบัญชี + ผู้บริหาร ─────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>💬</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>LINE กลุ่มภายใน</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                กลุ่มช่าง · ฝ่ายบัญชี · ผู้บริหาร — แจ้งเตือนอัตโนมัติเมื่อมีงานและการชำระเงิน
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
          <InternalGroupsSettings initialGroups={internalGroupsRes.data || []} />
        </div>

        {/* ─── 2. ฝ่ายบัญชี + ผู้บริหาร (LINE รายบุคคล) ───────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>👤</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>แจ้งเตือนรายบุคคล</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ฝ่ายบัญชีและผู้บริหาร — รับแจ้งเตือนส่วนตัวผ่าน LINE เพิ่มได้หลายคน
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
          <NotifyAccountsSettings initialAccounts={notifyAccountsRes.data || []} />
        </div>

        {/* ─── 2. LINE Group ลูกค้า (ขุนทอง) ──────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>🏦</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>LINE Group ลูกค้า + ขุนทอง</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                กลุ่มลูกค้าแต่ละราย เชื่อมกับขุนทอง KBank สำหรับรับชำระเงิน
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />

          {/* วิธีเชื่อมขุนทอง */}
          <div style={{ background: 'linear-gradient(135deg,#E1F5EE,#E6F1FB)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--dark)', marginBottom: 10 }}>🏦 วิธีเชื่อมกับขุนทอง (KBank)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
              {[
                { n: '1', t: 'สร้าง LINE Group กับลูกค้า', c: 'var(--brand)' },
                { n: '2', t: 'แอด LINE OA ร้านเข้า group', c: 'var(--brand)' },
                { n: '3', t: 'แอด @ขุนทอง เข้า group เดียวกัน', c: 'var(--amber)' },
                { n: '4', t: 'คัดลอก Group ID มาใส่ด้านล่าง', c: 'var(--blue)' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 22, height: 22, borderRadius: '50%', background: s.c, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
                  <div style={{ fontSize: 12, color: 'var(--dark)', paddingTop: 2 }}>{s.t}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
              💡 วิธีหา Group ID: เพิ่ม LINE OA เข้า group → ระบบรับ webhook พร้อม groupId อัตโนมัติ หรือดูจาก LINE Developers Console → Webhook logs
            </div>
          </div>

          <GroupSettingsForm
            groups={groupsRes.data || []}
            customers={customersRes.data || []}
          />
        </div>

        {/* ─── 3. Keyword ยืนยันชำระ ────────────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>💬</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>Keyword ยืนยันชำระ</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                เมื่อลูกค้าพิมพ์ข้อความเหล่านี้ใน LINE Group ระบบอัปเดต Invoice เป็น "ชำระแล้ว" อัตโนมัติ
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
          <KeywordSettingsForm keywords={keywordsRes.data || []} />
        </div>

        {/* ─── 4. ฟิลด์เพิ่มเติมใน Invoice ──────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>🧾</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>ฟิลด์เพิ่มเติมใน Invoice</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ปรับแต่ง Invoice ให้เป็นรูปแบบของร้าน — เพิ่ม ลบ แก้ไขฟิลด์ได้อิสระ
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
          <InvoiceFieldSettingsForm fields={invoiceFieldsRes.data || []} />
        </div>

        {/* ─── 5. ช่องทางยืนยันชำระเงินจากบอทธนาคาร (ขุนทอง) ────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 20 }}>🏦</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>บอทยืนยันการชำระเงิน (ขุนทอง)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ช่องทางที่ 4 ในการยืนยันชำระเงิน — ตรวจจาก LINE user ID ของขุนทองโดยตรง แม่นยำกว่า keyword
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
          <PaymentBotSettingsForm accounts={paymentBotsRes.data || []} />
        </div>

      </div>
    </AppLayout>
  )
}
