'use client'
import { useState } from 'react'

export default function DeleteJobButton({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`ลบงาน "${jobTitle}" ใช่ไหม?\n\nลบแล้วกู้คืนไม่ได้ ประวัติการแจ้งเตือน/แก้ไขของงานนี้จะหายไปด้วย`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert('❌ ลบไม่สำเร็จ: ' + (data.error || 'ไม่ทราบสาเหตุ'))
        setLoading(false)
        return
      }
      location.reload()
    } catch {
      alert('❌ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="btn btn-ghost"
      style={{ color: 'var(--red)', fontSize: 12, fontWeight: 700, padding: '4px 8px' }}
      title="ลบงานนี้"
    >
      {loading ? '...' : '🗑 ลบ'}
    </button>
  )
}
