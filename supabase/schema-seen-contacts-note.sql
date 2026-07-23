-- ══════════════════════════════════════════════════════════════════════════
-- 1) เพิ่มช่อง "โน้ต/ชื่อเรียก" ให้แอดมินตั้งเองได้ต่อคน (ทดแทนฟีเจอร์ rename ใน
--    LINE Official Account Manager ที่ดึงผ่าน API ไม่ได้ — เป็นข้อจำกัดของ LINE เอง)
-- 2) เพิ่ม profile_synced_at เพื่อให้ระบบรีเฟรชชื่อจริงจาก LINE เป็นระยะ แทนที่จะ
--    ดึงแค่ครั้งแรกครั้งเดียวแล้วไม่อัปเดตอีกเลยแม้ลูกค้าจะเปลี่ยนชื่อ LINE ภายหลัง
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE line_seen_contacts ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE line_seen_contacts ADD COLUMN IF NOT EXISTS profile_synced_at TIMESTAMPTZ;
