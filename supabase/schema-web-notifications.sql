-- ══════════════════════════════════════════════════════════════════════════
-- Migration: ระบบแจ้งเตือนในหน้าเว็บ (แยกจาก LINE แจ้งเตือน)
-- ใช้สำหรับ event ที่ไม่อยากรบกวนผ่าน LINE เช่น "มีคนแอดเพื่อน OA ใหม่"
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS web_notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        TEXT NOT NULL,          -- เช่น 'new_follower'
  title       TEXT NOT NULL,
  message     TEXT,
  link        TEXT,                    -- ลิงก์ไปหน้าที่เกี่ยวข้อง (ไม่บังคับ)
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE web_notifications DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_web_notifications_read    ON web_notifications(read);
CREATE INDEX IF NOT EXISTS idx_web_notifications_created ON web_notifications(created_at DESC);
