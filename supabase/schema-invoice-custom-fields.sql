-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Invoice ปรับแต่งฟิลด์ได้ตามร้าน + งานติดตั้ง (ไม่มีสินค้า) + ส่งผ่าน LINE (text) + ขุนทอง
-- รันไฟล์นี้ใน Supabase SQL Editor หลังจากรัน schema.sql หลักแล้ว
-- ══════════════════════════════════════════════════════════════════════════

-- ─── ฟิลด์ที่ร้านค้ากำหนดเอง (เพิ่ม/ลบ/แก้ไขได้จากหน้า Settings) ───────────
CREATE TABLE IF NOT EXISTS invoice_field_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_key   TEXT UNIQUE NOT NULL,        -- key เก็บใน invoices.custom_fields (เช่น 'install_location')
  label       TEXT NOT NULL,               -- ชื่อฟิลด์ที่แสดงในฟอร์ม/ใบแจ้งหนี้ เช่น 'จุดติดตั้ง'
  field_type  TEXT DEFAULT 'text' CHECK (field_type IN ('text','number','date','textarea')),
  required    BOOLEAN DEFAULT FALSE,
  sort_order  INT DEFAULT 0,
  active      BOOLEAN DEFAULT TRUE,        -- ปิดการใช้งานแทนการลบถาวร (ลบจริงก็ทำได้)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_invoice_field_templates_updated ON invoice_field_templates;
CREATE TRIGGER trg_invoice_field_templates_updated BEFORE UPDATE ON invoice_field_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── เพิ่มคอลัมน์ใน invoices ────────────────────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'installation'
  CHECK (invoice_type IN ('installation','product','other'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_channel TEXT; -- 'line_dm' | 'line_group' | 'line_dm+group'

-- ฟิลด์ตัวอย่างเริ่มต้นสำหรับงานติดตั้ง (แก้ไข/ลบได้ทีหลังจากหน้า Settings)
INSERT INTO invoice_field_templates (field_key, label, field_type, required, sort_order) VALUES
  ('install_location', 'จุดติดตั้ง',      'text', FALSE, 1),
  ('warranty',         'ระยะประกันงาน',   'text', FALSE, 2)
ON CONFLICT (field_key) DO NOTHING;
