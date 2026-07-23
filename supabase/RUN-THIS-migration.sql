-- ════════════════════════════════════════════════════════════
-- TEAM SYSTEM — ทีมช่าง 1 ทีม = 1 LINE Group, หลายช่างต่อทีม
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS technician_teams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  line_group_id   TEXT UNIQUE,
  line_group_name TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teams_updated ON technician_teams;
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON technician_teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE technicians ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES technician_teams(id) ON DELETE SET NULL;
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS is_team_lead BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_technicians_team ON technicians(team_id);

CREATE TABLE IF NOT EXISTS team_membership_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technician_id   UUID REFERENCES technicians(id) ON DELETE CASCADE,
  team_id         UUID REFERENCES technician_teams(id) ON DELETE SET NULL,
  action          TEXT NOT NULL CHECK (action IN ('joined','left','team_changed')),
  changed_by      UUID,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_logs_tech ON team_membership_logs(technician_id);
CREATE INDEX IF NOT EXISTS idx_team_logs_team ON team_membership_logs(team_id);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES technician_teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_team ON jobs(team_id);

ALTER TABLE technician_teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_membership_logs DISABLE ROW LEVEL SECURITY;
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

-- ✅ รันเสร็จแล้วทดสอบด้วย:
-- SELECT * FROM technician_teams;
-- SELECT * FROM job_edit_logs;


-- ════════════════════════════════════════════════════════════
-- JOB DOCUMENTS — แนบไฟล์เอกสารหลังติดตั้งเสร็จ (รูป + PDF)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_documents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID REFERENCES jobs(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,           -- ชื่อไฟล์ที่แสดง
  file_url     TEXT NOT NULL,           -- URL จาก Supabase Storage
  file_path    TEXT NOT NULL,           -- path ใน bucket (สำหรับลบ)
  file_type    TEXT NOT NULL,           -- 'image' | 'pdf'
  file_size    INTEGER,                 -- bytes
  doc_type     TEXT DEFAULT 'other'     -- 'invoice' | 'delivery' | 'signed' | 'other'
               CHECK (doc_type IN ('invoice','delivery','signed','other')),
  uploaded_by  TEXT,                    -- display_name ของ admin/ช่างที่อัปโหลด
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_documents_job ON job_documents(job_id);
ALTER TABLE job_documents DISABLE ROW LEVEL SECURITY;

-- Storage bucket 'job-documents' สร้างผ่าน Supabase Dashboard:
-- Storage → New bucket → ชื่อ: job-documents → Public: ON


-- ════════════════════════════════════════════════════════════
-- SYSTEM SETTINGS — ตั้งค่าทั่วไป บันทึกใน DB ไม่ใช่ env
-- ════════════════════════════════════════════════════════════

-- LINE Groups สำหรับแจ้งเตือนภายใน (ช่าง, บัญชี, ผู้บริหาร)
CREATE TABLE IF NOT EXISTS internal_line_groups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_type   TEXT NOT NULL CHECK (group_type IN ('technician_team','accounting','management','other')),
  name         TEXT NOT NULL,           -- ชื่อที่จำง่าย
  line_group_id TEXT NOT NULL UNIQUE,   -- LINE Group ID (ขึ้นต้นด้วย C)
  description  TEXT,
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE internal_line_groups DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_internal_line_groups_type ON internal_line_groups(group_type);


-- ════════════════════════════════════════════════════════════
-- NOTIFY ACCOUNTS — LINE User ID รายบุคคลสำหรับแจ้งเตือน
-- ฝ่ายบัญชี / ผู้บริหาร — เพิ่มได้หลายคน
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notify_accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_type   TEXT NOT NULL CHECK (account_type IN ('accounting','management')),
  name           TEXT NOT NULL,
  line_user_id   TEXT NOT NULL UNIQUE,
  active         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notify_accounts DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notify_accounts_type ON notify_accounts(account_type);
