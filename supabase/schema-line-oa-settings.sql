-- ══════════════════════════════════════════════════════════════════════════
-- Migration: ตั้งค่า LINE OA (Channel Access Token + Channel Secret) ผ่านหน้า Settings
-- บันทึกลงฐานข้อมูลแทนการต้องไปตั้งค่าใน environment variables ของ Vercel
-- ระบบจะ fallback ไปใช้ env var เดิมถ้ายังไม่เคยตั้งค่าในนี้ (ใช้งานต่อเนื่องได้ ไม่พัง)
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS line_oa_settings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_access_token  TEXT,
  channel_secret        TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE line_oa_settings DISABLE ROW LEVEL SECURITY;
