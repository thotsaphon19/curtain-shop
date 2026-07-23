-- ══════════════════════════════════════════════════════════════════════════
-- Migration: เลือกได้ว่าแต่ละกลุ่ม LINE (internal_line_groups) จะรับแจ้งเตือน
-- เรื่องอะไรบ้าง — รองรับ broadcast ไปหลายสิบกลุ่มพร้อมกัน แต่ละกลุ่มเลือก
-- รับเฉพาะบางเรื่องได้ (เช่น มีงานใหม่ / ส่ง Invoice / ลูกค้าชำระเงินแล้ว / งานเสร็จ)
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

-- เพิ่มคอลัมน์เก็บรายการ event ที่กลุ่มนี้ subscribe อยู่ (ค่าที่ใช้ได้ตอนนี้:
-- 'new_job', 'invoice_sent', 'payment_confirmed', 'job_completed')
ALTER TABLE internal_line_groups ADD COLUMN IF NOT EXISTS notify_events TEXT[] NOT NULL DEFAULT '{}';

-- ขยายประเภทกลุ่มให้มี 'broadcast' — ช่องทางแจ้งเตือนทั่วไป ไม่ผูกกับทีมช่าง/บัญชีโดยเฉพาะ
ALTER TABLE internal_line_groups DROP CONSTRAINT IF EXISTS internal_line_groups_group_type_check;
ALTER TABLE internal_line_groups ADD CONSTRAINT internal_line_groups_group_type_check
  CHECK (group_type IN ('technician_team','accounting','management','broadcast','other'));

CREATE INDEX IF NOT EXISTS idx_internal_line_groups_notify_events
  ON internal_line_groups USING GIN (notify_events);
