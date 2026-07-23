'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Notif {
  id: string
  type: string
  title: string
  message: string | null
  link: string | null
  read: boolean
  created_at: string
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'เมื่อสักครู่'
  if (min < 60) return `${min} นาทีที่แล้ว`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ชม.ที่แล้ว`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} วันที่แล้ว`
  return new Date(iso).toLocaleDateString('th-TH')
}

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications')
      const d = await r.json()
      setNotifs(d.data || [])
      setUnread(d.unreadCount || 0)
    } catch { /* เงียบไว้ ไม่ต้องรบกวนถ้าโหลดไม่สำเร็จชั่วคราว */ }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 20000) // เช็คทุก 20 วินาที
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'POST' })
    setUnread(0)
    setNotifs(n => n.map(x => ({ ...x, read: true })))
  }

  async function openNotif(n: Notif) {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' })
      setNotifs(list => list.map(x => x.id === n.id ? { ...x, read: true } : x))
      setUnread(u => Math.max(0, u - 1))
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div ref={boxRef} style={{ position: 'fixed', top: 14, right: 16, zIndex: 100 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        position: 'relative', width: 40, height: 40, borderRadius: '50%', border: 'none',
        background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', fontSize: 18, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2, background: '#E0483E', color: '#fff',
            borderRadius: '50%', minWidth: 18, height: 18, fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 48, right: 0, width: 320, maxHeight: 420, overflowY: 'auto',
          background: '#fff', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>แจ้งเตือน</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--brand,#0F6E56)', background: 'none', border: 'none', cursor: 'pointer' }}>
                อ่านทั้งหมด
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#999' }}>ยังไม่มีแจ้งเตือน</div>
          ) : notifs.map(n => (
            <div key={n.id} onClick={() => openNotif(n)} style={{
              padding: '10px 14px', borderBottom: '1px solid #f7f7f7', cursor: 'pointer',
              background: n.read ? '#fff' : '#F4FAF7',
            }}>
              <div style={{ fontSize: 12, fontWeight: n.read ? 500 : 700, color: '#222' }}>{n.title}</div>
              {n.message && <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>{n.message}</div>}
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
