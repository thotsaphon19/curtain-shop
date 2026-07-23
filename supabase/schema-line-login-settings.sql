-- ══════════════════════════════════════════════════════════════════════════
-- Migration: ตั้งค่า LINE Login (Channel ID / Channel Secret) ได้จากในระบบ
-- ไม่ต้องไปตั้งใน Vercel Environment Variables อีกต่อไป
-- (เดิม ต้องตั้ง env แล้ว "redeploy" ใหม่ทุกครั้งถึงจะมีผล — เปลี่ยนแล้วไม่ redeploy
--  จะยังใช้ค่าเก่าอยู่ ทำให้ error "invalid_client" ตลอด)
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS line_login_settings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE line_login_settings DISABLE ROW LEVEL SECURITY;

-- ย้ายค่าจาก env เดิม (ถ้าเคยตั้งไว้และมีการ redeploy จนใช้งานได้อยู่แล้ว) เข้ามาเป็นค่าเริ่มต้น
-- หมายเหตุ: ทำได้เฉพาะกรณีที่รู้ค่าจริงเท่านั้น ปกติแล้วแอดมินจะกรอกใหม่เองในหน้า Settings
