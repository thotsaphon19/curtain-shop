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
