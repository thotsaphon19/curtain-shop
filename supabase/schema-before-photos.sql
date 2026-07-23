-- ══════════════════════════════════════════════════════════════════════════
-- Migration: อนุญาต doc_type = 'before_photo' ใน job_documents
-- ใช้เก็บภาพถ่ายหน้างาน "ก่อนติดตั้ง" หลายภาพ (เดิมเก็บได้แค่ 1 ภาพผ่าน jobs.start_photo_url)
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE job_documents DROP CONSTRAINT IF EXISTS job_documents_doc_type_check;
ALTER TABLE job_documents ADD CONSTRAINT job_documents_doc_type_check
  CHECK (doc_type IN ('invoice','delivery','signed','other','site_photo','before_photo'));
