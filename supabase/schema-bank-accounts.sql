-- ══════════════════════════════════════════════════════════════════════════
-- รายชื่อบัญชีธนาคารของร้าน — ใช้ทำ dropdown เลือกบัญชีตอนสร้างงาน/ใบแจ้งหนี้
-- แทนการพิมพ์เลขบัญชีเองทุกครั้ง (เสี่ยงพิมพ์ผิด)
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bank_accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_name      TEXT NOT NULL,
  account_name   TEXT NOT NULL,
  account_number TEXT NOT NULL,
  branch         TEXT,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;

INSERT INTO bank_accounts (bank_name, account_name, account_number, sort_order) VALUES
  ('ธนาคารกสิกรไทย (KBank)', 'คุณพัชรพรรณ ลีกระจ่างแสง', '0621404083', 1),
  ('ธนาคารกรุงเทพ (Bangkok Bank)', 'พัชรีภรณ์ ลีกระจ่างแสง', '906-3-01484-0', 2);

INSERT INTO bank_accounts (bank_name, account_name, account_number, branch, sort_order) VALUES
  ('ทีเอ็มบีธนชาต (TTB)', 'บจก.ไพบูลย์ผ้าม่าน', '022-2-61665-8', 'คลองจั่น', 3);
