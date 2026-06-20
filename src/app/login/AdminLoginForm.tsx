'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginForm({ error, next }: { error?: string; next?: string }) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(error || '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr('')
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (data.success) {
      router.push(next || '/dashboard')
      router.refresh()
    } else {
      setErr(data.error || 'Username หรือ Password ไม่ถูกต้อง')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      {err && (
        <div style={{ background:'#FCEBEB', color:'#A32D2D', padding:'8px 12px', borderRadius:8, fontSize:13, marginBottom:14, fontWeight:600 }}>
          ❌ {err}
        </div>
      )}
      <div style={{ marginBottom:12 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#666', marginBottom:5 }}>Username</label>
        <input
          value={username} onChange={e => setUsername(e.target.value)}
          required placeholder="admin"
          style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #ddd', fontSize:14, boxSizing:'border-box' }}
        />
      </div>
      <div style={{ marginBottom:18 }}>
        <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#666', marginBottom:5 }}>Password</label>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          required placeholder="••••••••"
          style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #ddd', fontSize:14, boxSizing:'border-box' }}
        />
      </div>
      <button type="submit" disabled={loading} style={{
        width:'100%', padding:'12px', borderRadius:10, border:'none',
        background: loading ? '#aaa' : '#0F6E56', color:'#fff',
        fontSize:15, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? 'กำลังเข้าสู่ระบบ...' : '🔐 เข้าสู่ระบบ'}
      </button>
    </form>
  )
}
