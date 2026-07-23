-- ════════════════════════════════════════════════════════════
-- JOB EDIT HISTORY — บันทึกการแก้ไขข้อมูลงานทุกครั้ง
-- รันไฟล์นี้เพิ่มเติมจาก schema.sql เดิม
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS job_edit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      UUID REFERENCES jobs(id) ON DELETE CASCADE,
  edited_by   UUID,                 -- app_users.id ของ admin ที่แก้ไข (NULL ได้ถ้าไม่ผูก)
  edited_by_name TEXT,              -- เก็บชื่อตรงไว้ด้วย เผื่อ admin ถูกลบทีหลัง
  changes     JSONB NOT NULL,       -- { field: { old: ..., new: ... }, ... }
  note        TEXT,                -- หมายเหตุที่ admin พิมพ์เอง (ไม่บังคับ)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_edit_logs_job ON job_edit_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_edit_logs_date ON job_edit_logs(created_at);

ALTER TABLE job_edit_logs DISABLE ROW LEVEL SECURITY;
