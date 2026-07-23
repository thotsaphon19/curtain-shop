-- ══════════════════════════════════════════════════════════════════════════
-- ตั้งเวลาแจ้งเตือนตารางงานประจำวันให้ช่างได้จากหลังบ้าน (ไม่ต้องแก้โค้ด/deploy ใหม่)
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- ค่าเริ่มต้น: แจ้งเตือนช่างตอน 08:00 น. ทุกวัน (ตรงกับพฤติกรรมเดิมของระบบ)
INSERT INTO app_settings (key, value) VALUES ('daily_notification_time', '08:00')
ON CONFLICT (key) DO NOTHING;

-- เก็บวันที่ล่าสุดที่ส่งแจ้งเตือนตารางงานประจำวันไปแล้ว กันส่งซ้ำ
-- (จำเป็นเพราะ cron จะรันถี่ขึ้นเป็นทุก 15 นาที เพื่อเช็คว่าถึงเวลาที่ตั้งไว้หรือยัง)
INSERT INTO app_settings (key, value) VALUES ('daily_notification_last_sent', '')
ON CONFLICT (key) DO NOTHING;
