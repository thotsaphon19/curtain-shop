-- ══════════════════════════════════════════════════════════════════════════
-- Migration: อนุญาต doc_type = 'site_photo' ใน job_documents
-- ใช้สำหรับภาพหน้างานที่ช่างถ่ายตอนปิดงาน (แยกจากเอกสารลูกค้าเซ็น 'signed')
-- รันไฟล์นี้ใน Supabase SQL Editor หลังจากรัน schema.sql + RUN-THIS-migration.sql แล้ว
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE job_documents DROP CONSTRAINT IF EXISTS job_documents_doc_type_check;
ALTER TABLE job_documents ADD CONSTRAINT job_documents_doc_type_check
  CHECK (doc_type IN ('invoice','delivery','signed','other','site_photo'));
