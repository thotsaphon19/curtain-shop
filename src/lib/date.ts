// ช่วยคำนวณ "วันนี้" ให้ตรงกับเขตเวลาไทย (Asia/Bangkok, UTC+7) เสมอ
// ห้ามใช้ new Date().toISOString().split('T')[0] ตรงๆ เพราะ server รันที่ UTC
// ช่วงเที่ยงคืน–07:00 น. เวลาไทย ฝั่ง UTC ยังเป็น "เมื่อวาน" อยู่ ทำให้ query วันที่ผิดวัน
// (เช่น งานวันนี้หาไม่เจอ เพราะระบบคิดว่ายังเป็นเมื่อวาน)

export function getBangkokDateString(d: Date = new Date()): string {
  // 'en-CA' locale ให้ผลลัพธ์รูปแบบ YYYY-MM-DD ตรงกับที่ Postgres DATE column ต้องการพอดี
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

// คืนค่าเวลา "HH:MM" ปัจจุบันตามเขตเวลาไทย — ใช้เทียบกับเวลาที่ตั้งไว้ในหลังบ้าน (เช่น เวลาแจ้งเตือนช่างประจำวัน)
export function getBangkokTimeString(d: Date = new Date()): string {
  return d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
}

// คืนค่า Date object ที่ตั้งเวลาเที่ยงคืนของ "วันนี้" ตามเขตเวลาไทย
// ใช้ตอนต้องบวก/ลบวัน (เช่น หาวันจันทร์ของสัปดาห์) ให้ได้วันที่ถูกต้องเสมอ
export function getBangkokMidnight(d: Date = new Date()): Date {
  return new Date(`${getBangkokDateString(d)}T00:00:00`)
}
