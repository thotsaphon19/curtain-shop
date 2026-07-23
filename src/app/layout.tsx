import type { Metadata, Viewport } from 'next'
import { Noto_Sans_Thai } from 'next/font/google'
import './globals.css'

// โหลดฟอนต์แบบ self-host ผ่าน next/font แทนการยิง <link> ไป fonts.googleapis.com ตรงๆ
// เดิมต้องเปิดการเชื่อมต่อเพิ่ม 2 โดเมน (fonts.googleapis.com + fonts.gstatic.com) ก่อนจะ
// โหลดฟอนต์ได้ ซึ่งแต่ละโดเมนกิน DNS+TLS handshake เพิ่ม โดยเฉพาะเน็ตมือถือช้าๆ จะหน่วง
// เห็นชัดตอนเปิดหน้าแรก — next/font ดาวน์โหลดไฟล์ฟอนต์มาเสิร์ฟเองพร้อมแอป ไม่ต้องออกไปนอกโดเมน
const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ร้านผ้าม่าน — ระบบบริหารจัดการ',
  description: 'ระบบบริหารจัดการร้านผ้าม่านครบวงจร พร้อม Line OA + ขุนทอง',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ผ้าม่าน' },
}
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1,
  userScalable: false, viewportFit: 'cover',
  themeColor: '#0F2027',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={notoSansThai.className}>
      <body>{children}</body>
    </html>
  )
}
