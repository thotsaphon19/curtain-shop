-- =============================================
-- Admin เฟอร์นิเจอร์ — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── CUSTOMERS ───────────────────────────────
CREATE TABLE customers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  address      TEXT NOT NULL,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  line_user_id TEXT,                    -- Line OA user ID for push notifications
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TECHNICIANS ─────────────────────────────
CREATE TABLE technicians (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  line_user_id TEXT,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── JOBS ────────────────────────────────────
CREATE TABLE jobs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id          UUID REFERENCES customers(id) ON DELETE CASCADE,
  technician_id        UUID REFERENCES technicians(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  description          TEXT,
  address              TEXT NOT NULL,
  lat                  DOUBLE PRECISION,
  lng                  DOUBLE PRECISION,
  scheduled_date       DATE NOT NULL,
  scheduled_time       TIME NOT NULL,
  status               TEXT DEFAULT 'pending'
                         CHECK (status IN ('pending','assigned','in_progress','completed','cancelled','overdue')),
  start_photo_url      TEXT,            -- รูปถ่ายรับงาน
  end_photo_url        TEXT,            -- รูปถ่ายปิดงาน
  failure_reason       TEXT,            -- เหตุผลไม่เสร็จ
  amount               DECIMAL(10,2),  -- ยอดเรียกเก็บ
  bank_account         TEXT,
  qr_code_url          TEXT,
  accepted_at          TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── NOTIFICATIONS LOG ───────────────────────
CREATE TABLE notification_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID REFERENCES jobs(id) ON DELETE CASCADE,
  recipient    TEXT NOT NULL,           -- 'customer' | 'technician' | 'admin'
  line_user_id TEXT,
  type         TEXT NOT NULL,           -- 'booking_confirm','technician_assigned','on_the_way','job_done','overdue','daily_schedule'
  message      TEXT NOT NULL,
  sent_at      TIMESTAMPTZ DEFAULT NOW(),
  success      BOOLEAN DEFAULT TRUE,
  error_msg    TEXT
);

-- ─── INDEXES ─────────────────────────────────
CREATE INDEX idx_jobs_status        ON jobs(status);
CREATE INDEX idx_jobs_scheduled     ON jobs(scheduled_date);
CREATE INDEX idx_jobs_technician    ON jobs(technician_id);
CREATE INDEX idx_jobs_customer      ON jobs(customer_id);
CREATE INDEX idx_notif_job          ON notification_logs(job_id);

-- ─── AUTO update updated_at ──────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_technicians_updated BEFORE UPDATE ON technicians
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SEED DATA (ตัวอย่าง) ───────────────────
INSERT INTO technicians (name, phone) VALUES
  ('สมชาย ช่างดี', '0812345678'),
  ('สมหญิง ช่างเก่ง', '0823456789');

INSERT INTO customers (name, phone, address) VALUES
  ('คุณมานี มีใจ', '0834567890', '123 ถ.สุขุมวิท กรุงเทพฯ'),
  ('คุณปิติ สุขสม', '0845678901', '456 ถ.รัชดา กรุงเทพฯ');

-- ─── LINE AUTH SESSIONS ──────────────────────
CREATE TABLE user_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  picture_url  TEXT,
  role         TEXT DEFAULT 'customer' CHECK (role IN ('admin','technician','customer')),
  ref_id       UUID,   -- FK to customers or technicians
  access_token TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── QUOTATIONS (ใบเสนอราคา) ─────────────────
CREATE TABLE quotations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  quotation_no    TEXT UNIQUE NOT NULL,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','rejected')),
  subtotal        DECIMAL(12,2) DEFAULT 0,
  discount        DECIMAL(12,2) DEFAULT 0,
  vat_pct         DECIMAL(5,2) DEFAULT 7,
  total           DECIMAL(12,2) DEFAULT 0,
  valid_until     DATE,
  notes           TEXT,
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quotation_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id  UUID REFERENCES quotations(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  unit          TEXT,
  qty           DECIMAL(10,2) DEFAULT 1,
  unit_price    DECIMAL(12,2) DEFAULT 0,
  total         DECIMAL(12,2) GENERATED ALWAYS AS (qty * unit_price) STORED
);

-- ─── INVOICES ────────────────────────────────
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id    UUID REFERENCES quotations(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  invoice_no      TEXT UNIQUE NOT NULL,
  status          TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','overdue','cancelled')),
  subtotal        DECIMAL(12,2) DEFAULT 0,
  discount        DECIMAL(12,2) DEFAULT 0,
  vat_pct         DECIMAL(5,2) DEFAULT 7,
  total           DECIMAL(12,2) DEFAULT 0,
  paid_amount     DECIMAL(12,2) DEFAULT 0,
  due_date        DATE,
  paid_at         TIMESTAMPTZ,
  bank_account    TEXT,
  qr_code_url     TEXT,
  slip_url        TEXT,
  notes           TEXT,
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAYMENT REMINDERS CONFIG ────────────────
CREATE TABLE payment_reminder_configs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  days_after    INT NOT NULL,  -- วันหลังครบกำหนด (0=วันนั้น,-1=ก่อน1วัน)
  message_tpl   TEXT NOT NULL,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Default reminder config
INSERT INTO payment_reminder_configs (name, days_after, message_tpl) VALUES
  ('แจ้งวันครบกำหนด',   0,  'แจ้งเตือน: Invoice {invoice_no} ครบกำหนดชำระวันนี้ ยอด {amount} บาท'),
  ('ติดตาม 1 วัน',      1,  'เรียน คุณ{customer_name} ยังไม่ได้รับการชำระ Invoice {invoice_no} ยอด {amount} บาท กรุณาโอนค่ะ'),
  ('ติดตาม 3 วัน',      3,  'แจ้งเตือนครั้งที่ 2: Invoice {invoice_no} ค้างชำระ {days_overdue} วัน ยอด {amount} บาท');

-- ─── INVENTORY (คลังผ้าม่าน/ราง) ─────────────
CREATE TABLE inventory_categories (
  id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name  TEXT NOT NULL,
  icon  TEXT DEFAULT '📦'
);

INSERT INTO inventory_categories (name, icon) VALUES
  ('ผ้าม่าน','🪟'),('ราง','📏'),('อุปกรณ์ติดตั้ง','🔩'),('อื่นๆ','📦');

CREATE TABLE inventory_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES inventory_categories(id),
  name        TEXT NOT NULL,
  sku         TEXT UNIQUE,
  unit        TEXT DEFAULT 'ม้วน',
  qty         DECIMAL(12,2) DEFAULT 0,
  min_qty     DECIMAL(12,2) DEFAULT 0,  -- แจ้งเตือนเมื่อต่ำกว่า
  cost_price  DECIMAL(12,2) DEFAULT 0,
  sell_price  DECIMAL(12,2) DEFAULT 0,
  image_url   TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id     UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  type        TEXT CHECK (type IN ('in','out','adjust')),
  qty         DECIMAL(12,2),
  ref_job_id  UUID REFERENCES jobs(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAYMENT LOGS ─────────────────────────────
CREATE TABLE payment_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID REFERENCES invoices(id) ON DELETE CASCADE,
  amount      DECIMAL(12,2),
  method      TEXT,  -- 'transfer','cash','promptpay'
  slip_url    TEXT,
  note        TEXT,
  confirmed_by TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate quotation/invoice numbers
CREATE SEQUENCE quotation_seq START 1;
CREATE SEQUENCE invoice_seq START 1;

CREATE TRIGGER trg_quotations_updated BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── KHUNTHONG / LINE GROUP INTEGRATION ──────
CREATE TABLE line_group_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  group_id        TEXT NOT NULL,          -- LINE Group ID
  group_name      TEXT,
  khunthong_added BOOLEAN DEFAULT FALSE,   -- แอด @ขุนทอง แล้วหรือยัง
  auto_send       BOOLEAN DEFAULT TRUE,    -- ส่ง Invoice เข้า group อัตโนมัติ
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_group_customer ON line_group_settings(customer_id);
CREATE TRIGGER trg_group_updated BEFORE UPDATE ON line_group_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- keyword patterns ที่ถือว่า "ชำระแล้ว"
CREATE TABLE payment_keywords (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword  TEXT NOT NULL UNIQUE,
  active   BOOLEAN DEFAULT TRUE
);
INSERT INTO payment_keywords (keyword) VALUES
  ('โอนแล้ว'),('จ่ายแล้ว'),('ชำระแล้ว'),('โอนเงินแล้ว'),
  ('paid'),('payment done'),('transferred'),
  ('ขุนทอง'),('confirm');   -- ขุนทองส่ง confirm message

-- invoice_group_messages — log ข้อความที่ส่งเข้า group
CREATE TABLE invoice_group_messages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id   UUID REFERENCES invoices(id) ON DELETE CASCADE,
  group_id     TEXT NOT NULL,
  message_id   TEXT,                -- LINE message ID
  sent_at      TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT                 -- LINE user ID ที่พิมพ์ยืนยัน
);

-- ─── MAP & ROUTE PLANNING ─────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority INT DEFAULT 3
  CHECK (priority BETWEEN 1 AND 5);  -- 1=ด่วนมาก 5=ทั่วไป
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_duration INT DEFAULT 120;  -- นาที
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS travel_duration_to INT;  -- นาทีเดินทางจากจุดก่อน
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS travel_distance_to DECIMAL(8,2); -- กม.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS route_order INT; -- ลำดับที่วางแผน
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ; -- เวลา geocode ล่าสุด

CREATE TABLE IF NOT EXISTS route_plans (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technician_id  UUID REFERENCES technicians(id) ON DELETE CASCADE,
  plan_date      DATE NOT NULL,
  start_lat      DOUBLE PRECISION,
  start_lng      DOUBLE PRECISION,
  start_address  TEXT DEFAULT 'ร้านผ้าม่าน',
  job_order      JSONB,   -- [{job_id, order, travel_min, dist_km}]
  total_distance DECIMAL(8,2),
  total_duration INT,   -- นาที
  ai_suggestion  TEXT,  -- AI recommendation
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_route_tech_date ON route_plans(technician_id, plan_date);

-- ═══════════════════════════════════════════════════════════
-- USER MANAGEMENT + QUEUE SYSTEM
-- ═══════════════════════════════════════════════════════════

-- ─── Admin-managed user registry (all roles) ─────────────
CREATE TABLE IF NOT EXISTS app_users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id    TEXT UNIQUE,
  display_name    TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  role            TEXT NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('admin','technician','customer','viewer')),
  status          TEXT DEFAULT 'active'
                    CHECK (status IN ('active','inactive','suspended')),
  avatar_url      TEXT,
  ref_id          UUID,      -- FK to customers or technicians table
  permissions     JSONB DEFAULT '{}',  -- fine-grained: {"can_view_reports":true}
  invited_by      UUID REFERENCES app_users(id),
  last_login_at   TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_appusers_updated BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_appusers_role   ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_appusers_status ON app_users(status);

-- ─── Activity log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES app_users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,   -- 'login','assign_job','create_invoice','update_status'...
  target_type TEXT,            -- 'job','invoice','customer'...
  target_id   UUID,
  detail      JSONB,
  ip_addr     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_actlog_user ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_actlog_date ON user_activity_logs(created_at);

-- ─── Invitation tokens ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_invitations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  role        TEXT NOT NULL DEFAULT 'customer',
  invited_by  UUID REFERENCES app_users(id),
  used_by     UUID REFERENCES app_users(id),
  expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  used_at     TIMESTAMPTZ,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Queue / Calendar slots ───────────────────────────────
CREATE TABLE IF NOT EXISTS queue_slots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technician_id   UUID REFERENCES technicians(id) ON DELETE CASCADE,
  slot_date       DATE NOT NULL,
  slot_start      TIME NOT NULL,
  slot_end        TIME NOT NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  status          TEXT DEFAULT 'available'
                    CHECK (status IN ('available','booked','blocked')),
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_queue_unique ON queue_slots(technician_id, slot_date, slot_start);
CREATE INDEX idx_queue_date ON queue_slots(slot_date);
CREATE INDEX idx_queue_tech ON queue_slots(technician_id, slot_date);

-- ─── Working hours per technician ─────────────────────────
CREATE TABLE IF NOT EXISTS technician_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technician_id   UUID REFERENCES technicians(id) ON DELETE CASCADE UNIQUE,
  work_days       INT[] DEFAULT '{1,2,3,4,5,6}',  -- 0=Sun 6=Sat
  start_time      TIME DEFAULT '08:00',
  end_time        TIME DEFAULT '18:00',
  slot_duration   INT  DEFAULT 120,  -- นาที
  max_jobs_day    INT  DEFAULT 4,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
