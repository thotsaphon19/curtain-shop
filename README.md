# 🪟 ร้านผ้าม่าน — ระบบบริหารจัดการครบวงจร

**Stack:** Next.js 16 · Supabase (PostgreSQL) · LINE OA + Login · Vercel  
**Build:** ✅ 64 routes · 83 source files · Production ready

---

## 🚀 Deploy ใน 5 ขั้นตอน

### 1. Supabase — สร้าง Database

```
1. ไปที่ supabase.com → สร้าง project ใหม่ Tjk@091916tech
2. SQL Editor → วาง + รัน ไฟล์ supabase/schema.sql ทั้งหมด
3. Storage → สร้าง bucket ชื่อ "job-photos" (public)
4. Settings > API → คัดลอก URL, anon key, service_role key

https://supabase.com/dashboard/project/akzrbinsmwntfdpujlbh/settings/api-keys

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrenJiaW5zbXdudGZkcHVqbGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTAzNjIsImV4cCI6MjA5NzQ2NjM2Mn0.YPfUyra2cGvXh5ir86bKFuqj3tzF_-F3r2KSXUS4hIk

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrenJiaW5zbXdudGZkcHVqbGJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg5MDM2MiwiZXhwIjoyMDk3NDY2MzYyfQ.Y-Rb78xvOVER1DcF26dtMXsnYBwLFvF5c4qiL6Ude7o
```

### 2. LINE OA — ช่องทางแจ้งเตือน

```
1. developers.line.biz → สร้าง Messaging API channel
2. คัดลอก Channel Access Token (Long-lived) และ Channel Secret
3. เปิด Webhook (ใส่ URL หลัง deploy แล้ว)

axQ1SRc//NQL3OcBy+CH4O6Ktrzwl8iQ3/GwqcWytOOdxuILpnRssuAHCk2lWKsZNnz4HxQ9ldmlKRB2rZuGza1HVOYLsCPhNM2t5ob/y4RYIa/+di6/NiSjOMx2FJKwEpLJV3PRRsS6Fsbg48rSswdB04t89/1O/w1cDnyilFU=

557b68ddf94c4bceed877b3a07763608
```

### 3. LINE Login — สำหรับ Login ทุก Role

```
1. developers.line.biz → สร้าง LINE Login channel (แยกจาก OA)
2. Callback URL: https://YOUR_APP.vercel.app/api/auth/line/callback
3. คัดลอก Client ID และ Client Secret
```

### 4. Google Maps — แผนที่และเส้นทาง

```
1. console.cloud.google.com → เปิด APIs:
   - Maps JavaScript API   AIzaSyAYRdQ-6MXplUY9iTItBOhtbUS_-JUVb0w
   - Geocoding API
   - Distance Matrix API
2. สร้าง API Key (2 ตัว: Browser + Server)


AIzaSyDCsNQlblbFZOJW9D5tkFXQhAqN_OGu10k

AIzaSyDo6mQPsLa6WJEYeZQZdMv-oUV2LO8wakU
```

### 5. Deploy บน Vercel

```bash
# 1. Push โค้ดขึ้น GitHub
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/YOUR/repo.git
git push -u origin main

# 2. vercel.com → Import project → ใส่ Environment Variables
# 3. Deploy!
```

**Environment Variables ที่ต้องใส่ใน Vercel:**

| Variable | ที่มา |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings > API |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API channel |
| `LINE_CHANNEL_SECRET` | LINE Messaging API channel |
| `LINE_LOGIN_CLIENT_ID` | LINE Login channel |
| `LINE_LOGIN_CLIENT_SECRET` | LINE Login channel |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud Console |
| `GOOGLE_MAPS_SERVER_KEY` | Google Cloud Console |
| `NEXTAUTH_SECRET` | สุ่มเอง 32+ chars |
| `JWT_SECRET` | สุ่มเอง 64+ chars |
| `CRON_SECRET` | สุ่มเอง |
| `ADMIN_LINE_USER_IDS` | Line User ID ของ admin (comma-separated) |
| `ADMIN_LINE_USER_ID` | Line User ID admin คนแรก (สำหรับ notify) |
| `NEXT_PUBLIC_APP_URL` | https://your-app.vercel.app |

### หลัง Deploy แล้ว

```
1. ใส่ Webhook URL ใน LINE OA:
   https://your-app.vercel.app/api/line/webhook

2. เปิด LINE OA ของคุณ → ส่งข้อความ → ดู Webhook logs
   คัดลอก userId ของตัวเองใส่ใน ADMIN_LINE_USER_IDS

3. เข้า https://your-app.vercel.app/login
   เลือก "เจ้าของร้าน / Admin" → Login ด้วย LINE
```

---

## 📱 โครงสร้างระบบ

### หน้าสำหรับ Admin
| หน้า | ฟีเจอร์ |
|------|---------|
| `/dashboard` | สรุปงานวันนี้ ยอดค้าง สถิติ |
| `/queue` | ปฏิทินจัดคิว click-to-assign ช่างแต่ละคน |
| `/map` | Google Maps + AI วางเส้นทาง |
| `/jobs` | จัดการงานทั้งหมด filter ตาม status |
| `/jobs/[id]` | รายละเอียดงาน + มอบหมาย + เปลี่ยน status |
| `/jobs/new` | สร้างงานใหม่ + แจ้ง LINE ทันที |
| `/quotations` | ใบเสนอราคาผ้าม่าน |
| `/invoices` | Invoice + ติดตามการชำระ |
| `/payments` | ยอดค้างชำระ + Reminder Config |
| `/line-notify` | แจ้งเตือนลูกค้ารายบุคคล / bulk |
| `/customers` | จัดการลูกค้า |
| `/customers/[id]` | โปรไฟล์ลูกค้า + Notify Panel |
| `/technicians` | จัดการช่าง |
| `/inventory` | คลังผ้าม่าน/ราง/อุปกรณ์ |
| `/reports` | รายงานช่วงวันที่ |
| `/admin/users` | บริหาร User ทุก role + Activity log |
| `/admin/users/[id]` | โปรไฟล์ + Permissions + Stats |
| `/settings` | LINE Group + ขุนทอง + Keywords |

### หน้าสำหรับช่าง
| หน้า | ฟีเจอร์ |
|------|---------|
| `/technician` | ตารางงานวันนี้ |
| `/technician/[job]` | รับงาน + ถ่ายรูป + ปิดงาน |

### หน้าสำหรับลูกค้า
| หน้า | ฟีเจอร์ |
|------|---------|
| `/customer-portal` | ดูงาน invoice QR ชำระเงิน |

---

## 🔔 LINE OA Triggers

| Trigger | ผู้รับ | ข้อความ |
|---------|--------|---------|
| Admin ลงคิว | ลูกค้า | ยืนยันนัด + ลิงค์ |
| มอบหมายงาน | ช่าง | รายละเอียด + แผนที่ |
| ช่างรับงาน | ลูกค้า | กำลังเดินทาง |
| ปิดงาน | ลูกค้า | รูปงาน + QR + บัญชี |
| งานค้าง | Admin | แจ้งทันที |
| 08:00 ทุกวัน | ช่าง | ตารางงานประจำวัน |
| Invoice ส่งเข้า Group | ลูกค้า | Flex Message card |
| ขุนทอง confirm | ระบบ | อัปเดต Invoice paid อัตโนมัติ |

---

## 🏗️ Architecture

```
furniture-admin/
├── src/
│   ├── app/
│   │   ├── api/                    # 35 API routes
│   │   │   ├── admin/              # User management APIs
│   │   │   ├── auth/               # LINE Login OAuth
│   │   │   ├── jobs/               # Jobs CRUD + assign
│   │   │   ├── invoices/           # Invoice management
│   │   │   ├── line/               # Webhook + notify
│   │   │   ├── map/                # Geocode + route optimize
│   │   │   ├── payments/           # Reminder + keywords
│   │   │   ├── queue/              # Slot management
│   │   │   └── cron/               # Daily scheduled tasks
│   │   ├── admin/users/            # User management UI
│   │   ├── queue/                  # Queue calendar UI
│   │   ├── map/                    # Map + route UI
│   │   ├── technician/             # Technician mobile app
│   │   └── customer-portal/        # Customer portal
│   ├── components/
│   │   ├── layout/AppLayout.tsx    # Responsive shell + bottom nav
│   │   └── ui/StatusBadge.tsx
│   ├── lib/
│   │   ├── supabase.ts             # DB client
│   │   ├── line.ts                 # LINE messaging
│   │   ├── maps.ts                 # Google Maps + route AI
│   │   └── session.ts              # JWT auth
│   ├── types/index.ts              # TypeScript types
│   └── middleware.ts               # Route guards
├── supabase/schema.sql             # Complete DB schema
├── .env.example                    # Environment template
└── vercel.json                     # Cron + function config
```

---

## 💻 Development

```bash
cp .env.example .env.local
# แก้ไขค่าใน .env.local

npm install
npm run dev
# เปิด http://localhost:3000
```

---

## 📊 Database Tables

| Table | ใช้สำหรับ |
|-------|----------|
| `customers` | ข้อมูลลูกค้า |
| `technicians` | ข้อมูลช่าง |
| `jobs` | งานทั้งหมด |
| `quotations` + `quotation_items` | ใบเสนอราคา |
| `invoices` | ใบแจ้งหนี้ |
| `payment_logs` | ประวัติการชำระ |
| `payment_reminder_configs` | config แจ้งเตือน |
| `payment_keywords` | keyword ยืนยันชำระ |
| `inventory_items` + `categories` | คลังสินค้า |
| `inventory_transactions` | รับ/จ่ายสต็อก |
| `line_group_settings` | LINE Group ต่อลูกค้า |
| `invoice_group_messages` | log ส่ง Invoice ใน Group |
| `route_plans` | แผนเส้นทาง AI |
| `queue_slots` | time slots ช่าง |
| `technician_schedules` | เวลาทำงานช่าง |
| `app_users` | User registry ทุก role |
| `user_activity_logs` | Activity log |
| `user_invitations` | Invite tokens |
| `user_sessions` | LINE session |
| `notification_logs` | Log การส่ง LINE |
