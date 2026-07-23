-- ══════════════════════════════════════════════════════════════════════════
-- กันประมวลผลข้อความ LINE ซ้ำ — LINE จะส่ง webhook ซ้ำอัตโนมัติถ้าเซิร์ฟเวอร์เรา
-- ตอบกลับช้าเกินไป (หรือ error) ทำให้ event เดิมถูกประมวลผลซ้ำ 2 รอบขึ้นไป
-- ส่งผลให้ auto-reply/บันทึกข้อมูลบางอย่างเกิดขึ้นซ้ำๆ (เช่น ข้อความเดิมส่งซ้ำหลายครั้ง)
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS line_processed_messages (
  message_id   TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE line_processed_messages DISABLE ROW LEVEL SECURITY;

-- ลบ record เก่าเกิน 7 วันอัตโนมัติได้ (ไม่บังคับ แค่กันตารางบวม รันเองเป็นระยะได้ถ้าต้องการ)
-- DELETE FROM line_processed_messages WHERE processed_at < NOW() - INTERVAL '7 days';
