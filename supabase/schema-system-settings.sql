-- ══════════════════════════════════════════════════════════════════════════
-- ตาราง system_settings — เก็บค่าตั้งค่าทั่วไปแบบ key-value
-- ใช้ครั้งแรกสำหรับ: เวลาที่ระบบส่งแจ้งเตือนตารางงานประจำวันให้ช่างทุกเช้า (ตั้งได้จากหลังบ้าน)
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- ชั่วโมง (0-23, เวลาไทย) ที่ระบบจะส่งตารางงานประจำวันให้ช่างแต่ละคนอัตโนมัติ — ค่าเริ่มต้น 8 (08:00 น.)
INSERT INTO system_settings (key, value) VALUES ('daily_notify_hour', '8')
  ON CONFLICT (key) DO NOTHING;

-- วันที่ล่าสุดที่ส่งแจ้งเตือนตารางงานประจำวันไปแล้ว (YYYY-MM-DD) — กันส่งซ้ำถ้า cron รันมากกว่า 1 ครั้ง/ชม.
INSERT INTO system_settings (key, value) VALUES ('daily_notify_last_sent', '')
  ON CONFLICT (key) DO NOTHING;
