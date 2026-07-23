-- ══════════════════════════════════════════════════════════════════════════
-- Migration: เพิ่มสถานะ 'heading' (กำลังไปหน้างาน) ระหว่าง assigned กับ in_progress
-- แยกขั้นตอน "กดรับงาน" (ไม่ต้องถ่ายรูป) ออกจาก "ถ่ายรูปหน้างานก่อนเริ่ม + กดบันทึก"
-- ลำดับสถานะใหม่: pending → assigned → heading → in_progress → completed
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('pending','assigned','heading','in_progress','completed','cancelled','overdue'));
