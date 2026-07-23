-- ══════════════════════════════════════════════════════════════════════════
-- เพิ่มรายละเอียดยอดเรียกเก็บ: ยอดทั้งหมด / มัดจำ / คงเหลือ (คำนวณอัตโนมัติ) / VAT / เลขที่ Invoice
-- รันไฟล์นี้ใน Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS invoice_no TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS has_invoice_no BOOLEAN DEFAULT false;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2);
