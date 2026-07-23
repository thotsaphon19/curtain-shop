-- ══════════════════════════════════════════════════════════════════════════
-- Migration: ช่องทางยืนยันชำระเงินจาก "บอทธนาคาร" เช่น @ขุนทอง (KBank)
-- แยกจาก keyword matching เดิม — ถ้าข้อความมาจาก LINE user ID ของบอทที่ลงทะเบียนไว้
-- ระบบจะถือว่าเป็นการยืนยันชำระเงินที่แน่นอน (ไม่ต้องพึ่ง keyword ในข้อความ)
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payment_bot_accounts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL DEFAULT 'ขุนทอง (KBank)',
  line_user_id TEXT UNIQUE NOT NULL,   -- LINE user ID ของบอท (หาได้จาก webhook logs ตอนบอทส่งข้อความครั้งแรก)
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_bot_accounts DISABLE ROW LEVEL SECURITY;
