-- ══════════════════════════════════════════════════════════════════════════
-- Migration: จำ LINE userId / groupId ที่เคยติดต่อเข้ามา ไว้ในฐานข้อมูล
-- เพื่อให้แอดมินเข้าหน้า Settings แล้วคัดลอก ID ไปใช้ได้เลย
-- ไม่ต้องเข้าไปงมใน Vercel Logs อีกต่อไป
-- รันไฟล์นี้ใน Supabase SQL Editor (ต้องรันหลัง schema-multi-oa.sql)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS line_seen_contacts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind           TEXT NOT NULL CHECK (kind IN ('user','group')),
  line_id        TEXT UNIQUE NOT NULL,              -- userId (ขึ้นต้น U) หรือ groupId (ขึ้นต้น C)
  display_name   TEXT,                               -- ชื่อ LINE ของคน หรือชื่อกลุ่ม (ดึงจาก LINE API อัตโนมัติ)
  picture_url    TEXT,
  last_message   TEXT,                                -- ข้อความล่าสุดที่ทักมา (ไว้ช่วยจำว่าใคร)
  oa_account_id  UUID REFERENCES line_oa_accounts(id) ON DELETE SET NULL,
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE line_seen_contacts DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_line_seen_contacts_kind      ON line_seen_contacts(kind);
CREATE INDEX IF NOT EXISTS idx_line_seen_contacts_last_seen ON line_seen_contacts(last_seen_at DESC);
