import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import QueueBoard from './QueueBoard'
import { getBangkokMidnight } from '@/lib/date'
export const dynamic = 'force-dynamic'

export default async function QueuePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const params = await searchParams

  // Default: current week Mon–Sun
  const today = getBangkokMidnight()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const weekStart = params.week_start || monday.toISOString().split('T')[0]
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(new Date(weekStart).getDate() + 6)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  const [techRes, jobsRes, slotsRes, schedRes] = await Promise.all([
    supabaseAdmin.from('technicians').select('id,name,line_user_id').eq('status', 'active').order('name'),
    supabaseAdmin.from('jobs')
      .select('*, customer:customers(name,phone,address)')
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', weekEndStr)
      .order('scheduled_date').order('scheduled_time'),
    supabaseAdmin.from('queue_slots')
      .select('*, job:jobs(id,title,status,customer:customers(name))')
      .gte('slot_date', weekStart)
      .lte('slot_date', weekEndStr)
      .order('slot_date').order('slot_start'),
    supabaseAdmin.from('technician_schedules').select('*'),
  ])

  // ── กันงานหาย: ต้องมีแถวให้ทุกช่างที่ถูกมอบหมายงานในสัปดาห์นี้เสมอ ──────────
  // เดิมถ้าช่างคนไหน status ไม่ใช่ 'active' (เช่น โดนปิดใช้งาน หรือเป็น record ซ้ำซ้อน
  // จากตอนย้าย LINE OA) งานที่มอบหมายให้ช่างคนนั้นจะไม่มีแถวให้แสดงเลย ปฏิทินจะดูว่างเปล่า
  // ทั้งที่จริงมีงานอยู่ — ดึงช่างที่ขาดไปมาเพิ่มเป็นแถวด้วย จะได้ไม่มีงานไหนหายไปจากตาราง
  const jobs = jobsRes.data || []
  const activeTechs = techRes.data || []
  const activeTechIds = new Set(activeTechs.map(t => t.id))
  const missingTechIds = [...new Set(jobs.map(j => j.technician_id).filter((id): id is string => !!id && !activeTechIds.has(id)))]

  let allTechsRaw: { id: string; name: string; line_user_id?: string; status?: string }[] = activeTechs
  if (missingTechIds.length > 0) {
    const { data: extraTechs } = await supabaseAdmin
      .from('technicians').select('id,name,line_user_id,status').in('id', missingTechIds)
    if (extraTechs && extraTechs.length > 0) {
      allTechsRaw = [...activeTechs, ...extraTechs.map(t => ({ id: t.id, name: `${t.name}${t.status !== 'active' ? ' (ปิดใช้งาน)' : ''}`, line_user_id: t.line_user_id }))]
    }
  }

  // ── รวมแถวช่างที่ชื่อซ้ำกันเป็นแถวเดียว ────────────────────────────────────
  // ปัญหาที่เจอ: ตอนย้าย LINE OA เคยมีบั๊กสร้างช่างซ้ำ (เช่น "Fai" 2 record คนละ id)
  // ถ้างานถูกมอบหมายให้ id ของ record ที่ "ไม่ใช่" record หลักที่โชว์อยู่ งานนั้นจะดูเหมือน
  // หายไปจากปฏิทิน (จริงๆ อยู่ในระบบปกติ แค่ไปโผล่ใต้แถวช่างชื่อเดียวกันอีก record หนึ่ง)
  // แก้ด้วยการรวมทุก id ที่ชื่อตรงกัน (ตัดช่องว่าง/ตัวพิมพ์) ให้จับคู่งานเข้าแถวเดียวกันหมด
  // ส่วนการมอบหมายงานใหม่ยังคงอ้างอิง id ของ record หลัก (record แรกที่เจอ) เหมือนเดิม
  const groupedByName = new Map<string, { id: string; name: string; line_user_id?: string; group_ids: string[] }>()
  for (const t of allTechsRaw) {
    const key = t.name.replace(/\s*\(ปิดใช้งาน\)\s*$/, '').trim().toLowerCase()
    const existing = groupedByName.get(key)
    if (existing) {
      existing.group_ids.push(t.id)
      if (!existing.line_user_id && t.line_user_id) existing.line_user_id = t.line_user_id
    } else {
      groupedByName.set(key, { id: t.id, name: t.name, line_user_id: t.line_user_id, group_ids: [t.id] })
    }
  }
  const allTechs = [...groupedByName.values()]

  // Unassigned jobs (no technician yet)
  const { data: unassigned } = await supabaseAdmin
    .from('jobs')
    .select('*, customer:customers(name,phone,address)')
    .eq('status', 'pending')
    .order('scheduled_date').order('priority')
    .limit(50)

  return (
    <AppLayout user={session}>
      <QueueBoard
        technicians={allTechs}
        jobs={jobs}
        slots={slotsRes.data || []}
        schedules={schedRes.data || []}
        unassigned={unassigned || []}
        weekStart={weekStart}
        weekEnd={weekEndStr}
      />
    </AppLayout>
  )
}
