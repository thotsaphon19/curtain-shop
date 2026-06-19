import { JobStatus } from '@/types'
const S: Record<JobStatus, [string,string]> = {
  pending:     ['รอมอบหมาย', 'badge badge-amber'],
  assigned:    ['มอบหมายแล้ว', 'badge badge-blue'],
  in_progress: ['กำลังดำเนินงาน', 'badge badge-brand'],
  completed:   ['เสร็จแล้ว', 'badge badge-green'],
  cancelled:   ['ยกเลิก', 'badge badge-gray'],
  overdue:     ['เกินกำหนด', 'badge badge-red'],
}
export default function StatusBadge({ status }: { status: JobStatus }) {
  const [label, cls] = S[status] || S.pending
  return <span className={cls}>{label}</span>
}
