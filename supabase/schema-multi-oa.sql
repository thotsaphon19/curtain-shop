-- ══════════════════════════════════════════════════════════════════════════
-- Migration: รองรับ LINE OA หลายบัญชี (multi-OA)
-- แต่ละบัญชีมี Channel Access Token / Channel Secret ของตัวเอง
-- กลุ่ม/บุคคล/ลูกค้า/ช่าง แต่ละรายเลือกได้ว่าผูกกับ OA บัญชีไหน
-- (ถ้าไม่เลือก = ใช้บัญชี default อัตโนมัติ ใช้งานต่อเนื่องได้ ไม่พัง)
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS line_oa_accounts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  channel_access_token  TEXT NOT NULL,
  channel_secret        TEXT NOT NULL,
  is_default            BOOLEAN NOT NULL DEFAULT FALSE,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE line_oa_accounts DISABLE ROW LEVEL SECURITY;

-- มี default ได้แค่บัญชีเดียวเท่านั้น
CREATE UNIQUE INDEX IF NOT EXISTS idx_line_oa_accounts_one_default
  ON line_oa_accounts (is_default) WHERE is_default;

-- ย้ายค่าที่เคยตั้งไว้ในหน้า Settings เดิม (บัญชีเดียว) มาเป็นบัญชี default อัตโนมัติ
-- เพื่อให้ระบบทำงานต่อได้เลยหลัง migrate โดยไม่ต้องตั้งค่าใหม่
INSERT INTO line_oa_accounts (name, channel_access_token, channel_secret, is_default)
SELECT 'บัญชีหลัก (ย้ายจากค่าเดิม)', channel_access_token, channel_secret, TRUE
FROM line_oa_settings
WHERE channel_access_token IS NOT NULL AND channel_secret IS NOT NULL
ORDER BY updated_at DESC LIMIT 1
ON CONFLICT DO NOTHING;

-- ผูกว่าปลายทางแต่ละแบบเป็นของ OA บัญชีไหน (NULL = ใช้บัญชี default)
ALTER TABLE IF EXISTS internal_line_groups  ADD COLUMN IF NOT EXISTS oa_account_id UUID REFERENCES line_oa_accounts(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS notify_accounts       ADD COLUMN IF NOT EXISTS oa_account_id UUID REFERENCES line_oa_accounts(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS line_group_settings   ADD COLUMN IF NOT EXISTS oa_account_id UUID REFERENCES line_oa_accounts(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS payment_bot_accounts  ADD COLUMN IF NOT EXISTS oa_account_id UUID REFERENCES line_oa_accounts(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS customers             ADD COLUMN IF NOT EXISTS oa_account_id UUID REFERENCES line_oa_accounts(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS technicians           ADD COLUMN IF NOT EXISTS oa_account_id UUID REFERENCES line_oa_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_internal_line_groups_oa ON internal_line_groups(oa_account_id);
CREATE INDEX IF NOT EXISTS idx_notify_accounts_oa      ON notify_accounts(oa_account_id);
CREATE INDEX IF NOT EXISTS idx_line_group_settings_oa  ON line_group_settings(oa_account_id);
CREATE INDEX IF NOT EXISTS idx_customers_oa            ON customers(oa_account_id);
CREATE INDEX IF NOT EXISTS idx_technicians_oa          ON technicians(oa_account_id);
