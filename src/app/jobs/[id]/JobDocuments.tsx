'use client'
import { useState, useRef } from 'react'

interface Doc {
  id: string
  name: string
  file_url: string
  file_type: 'image' | 'pdf'
  file_size?: number
  doc_type: string
  uploaded_by?: string
  created_at: string
}

const DOC_TYPES = [
  { key: 'site_photo', label: '📷 ภาพหน้างานเสร็จ' },
  { key: 'invoice',  label: '📄 ใบแจ้งหนี้' },
  { key: 'delivery', label: '📋 หนังสือส่งมอบงาน' },
  { key: 'signed',   label: '✍️ เอกสารลูกค้าเซ็น' },
  { key: 'other',    label: '📎 อื่นๆ' },
]

export default function JobDocuments({ jobId, initialDocs }: { jobId: string; initialDocs: Doc[] }) {
  const [docs, setDocs] = useState<Doc[]>(initialDocs)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('invoice')
  const [docName, setDocName] = useState('')
  const [preview, setPreview] = useState<Doc | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const allowed = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf']
      if (!allowed.includes(ext)) {
        flash(`❌ ไม่รองรับไฟล์ .${ext}`, false)
        continue
      }
      if (file.size > 15 * 1024 * 1024) {
        flash(`❌ "${file.name}" ใหญ่เกิน 15 MB`, false)
        continue
      }

      // อ่านไฟล์เป็น base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/jobs/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          name: docName.trim() || file.name,
          base64,
          filename: file.name,
          doc_type: docType,
        }),
      })
      const data = await res.json()
      if (data.data) {
        setDocs(d => [...d, data.data])
        flash(`✅ อัปโหลด "${data.data.name}" แล้ว`)
      } else {
        flash(`❌ ${data.error}`, false)
      }
    }

    setUploading(false)
    setDocName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteDoc(doc: Doc) {
    if (!confirm(`ลบ "${doc.name}"?`)) return
    const res = await fetch(`/api/jobs/documents?id=${doc.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDocs(d => d.filter(x => x.id !== doc.id))
      flash(`✅ ลบ "${doc.name}" แล้ว`)
    }
  }

  const docTypeLabel = (key: string) => DOC_TYPES.find(t => t.key === key)?.label || key

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)' }}>
          📎 เอกสารแนบ ({docs.length})
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12, fontSize: 13 }}>
          {msg.text}
        </div>
      )}

      {/* Upload zone */}
      <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: 16, marginBottom: 16, background: 'var(--gray)' }}>
        <div style={{ marginBottom: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px' }}>
            <label className="label">ประเภทเอกสาร</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} className="input" style={{ fontSize: 13 }}>
              {DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: '2 1 200px' }}>
            <label className="label">ชื่อเอกสาร (ไม่บังคับ)</label>
            <input value={docName} onChange={e => setDocName(e.target.value)}
              placeholder="เว้นว่างไว้ใช้ชื่อไฟล์" className="input" style={{ fontSize: 13 }} />
          </div>
        </div>

        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input
            ref={fileRef} type="file" multiple accept="image/*,.pdf"
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          <div style={{
            textAlign: 'center', padding: '14px 10px', borderRadius: 8,
            background: uploading ? 'var(--brand-lt)' : 'var(--white)',
            border: '1.5px solid var(--border)', cursor: 'pointer',
            color: uploading ? 'var(--brand)' : 'var(--text-muted)', fontSize: 13,
          }}>
            {uploading
              ? '⏳ กำลังอัปโหลด...'
              : <>📤 คลิกเพื่อเลือกไฟล์ <span style={{ fontSize: 11 }}>(รูปภาพ jpg/png/webp หรือ PDF — สูงสุด 15 MB)</span></>
            }
          </div>
        </label>
      </div>

      {/* Documents list */}
      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          ยังไม่มีเอกสารแนบ
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--white)',
            }}>
              {/* Thumbnail / icon */}
              <div style={{ width: 48, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--gray)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {doc.file_type === 'image' ? (
                  <img src={doc.file_url} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => setPreview(doc)} />
                ) : (
                  <span style={{ fontSize: 24 }}>📄</span>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {docTypeLabel(doc.doc_type)} ·{doc.file_size ? ` ${doc.file_size} KB ·` : ''} {new Date(doc.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <a href={doc.file_url} target="_blank" rel="noreferrer"
                  className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>
                  {doc.file_type === 'pdf' ? '📄 เปิด' : '🔍 ดู'}
                </a>
                <a href={doc.file_url} download={doc.name}
                  className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>
                  ⬇️
                </a>
                <button onClick={() => deleteDoc(doc)}
                  className="btn btn-danger" style={{ fontSize: 11, padding: '4px 10px' }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image preview modal */}
      {preview && preview.file_type === 'image' && (
        <div className="overlay" onClick={() => setPreview(null)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
            <img src={preview.file_url} alt={preview.name} style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', display: 'block' }} />
            <div style={{ padding: '8px 14px', background: '#111', color: '#ccc', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>{preview.name}</span>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕ ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
