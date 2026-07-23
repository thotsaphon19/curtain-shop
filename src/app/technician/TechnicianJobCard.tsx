'use client'
import { useState, useRef, useEffect } from 'react'
import { Job } from '@/types'

interface JobDoc { id: string; name: string; file_url: string; doc_type: string; created_at: string }

export default function TechnicianJobCard({ job, initialExpanded, onStatusChange }: { job: Job; initialExpanded?: boolean; onStatusChange?: (jobId: string, status: string) => void }) {
  const [status, setStatus] = useState(job.status)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showDetail, setShowDetail] = useState(!!initialExpanded)

  const MAX_PHOTOS = 20 // จำกัดสูงสุด 20 ภาพต่อประเภท กันช่างถ่ายเผลอเยอะเกินจนอัปโหลดช้า/พื้นที่เก็บบาน

  // ── ภาพถ่ายก่อนติดตั้ง (บันทึกได้หลายภาพ เหมือนภาพหลังติดตั้ง) ────────────
  const beforePhotoRef = useRef<HTMLInputElement>(null)
  const [beforePhotos, setBeforePhotos] = useState<JobDoc[]>([])
  const [uploadingBefore, setUploadingBefore] = useState(false)

  // ── ภาพหน้างานที่ติดตั้งเสร็จ + เอกสารที่ลูกค้าเซ็น (บันทึกได้หลายภาพ) ──────
  const sitePhotoRef = useRef<HTMLInputElement>(null)
  const docPhotoRef = useRef<HTMLInputElement>(null)
  const [sitePhotos, setSitePhotos] = useState<JobDoc[]>([])
  const [docPhotos, setDocPhotos] = useState<JobDoc[]>([])
  const [uploadingSite, setUploadingSite] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docsLoaded, setDocsLoaded] = useState(false)

  const cust = (job as unknown as {customer:{name:string,phone:string,address:string}}).customer

  // โหลดภาพที่เคยถ่ายไว้แล้ว (เผื่อรีเฟรชหน้าระหว่างทำงาน) เมื่อเปิดดูรายละเอียดงานที่กำลังทำอยู่
  // โหลดตั้งแต่ตอน "heading" แล้ว เพราะภาพก่อนติดตั้งถ่ายได้ในสถานะนี้
  useEffect(() => {
    if (!showDetail || docsLoaded || (status !== 'heading' && status !== 'in_progress' && status !== 'completed')) return
    fetch(`/api/jobs/documents?job_id=${job.id}`).then(r => r.json()).then(d => {
      const docs: JobDoc[] = d.data || []
      setBeforePhotos(docs.filter(x => x.doc_type === 'before_photo'))
      setSitePhotos(docs.filter(x => x.doc_type === 'site_photo'))
      setDocPhotos(docs.filter(x => x.doc_type === 'signed'))
      setDocsLoaded(true)
    }).catch(() => setDocsLoaded(true))
  }, [showDetail, docsLoaded, status, job.id])

  async function updateStatus(newStatus: string) {
    setLoading(true)
    setMsg('')
    try {
      const body: Record<string, unknown> = { status: newStatus }
      // ปิดงาน: แนบภาพหน้างานเสร็จภาพแรกไว้ที่ end_photo_url เพื่อส่งแนบไปกับ LINE แจ้งลูกค้าด้วย
      if (newStatus === 'completed' && sitePhotos[0]) body.end_photo_url = sitePhotos[0].file_url

      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) setMsg('❌ ' + data.error)
      else {
        setStatus(newStatus as Job['status'])
        setMsg('✅ อัปเดตแล้ว')
        onStatusChange?.(job.id, newStatus)
      }
    } catch { setMsg('❌ เกิดข้อผิดพลาด') }
    setLoading(false)
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // ── บีบอัดรูปก่อนอัปโหลด — สำคัญมาก ────────────────────────────────────────
  // กล้องมือถือถ่ายรูปออกมาไฟล์ใหญ่มาก (มักเกิน 3-10MB) พอแปลงเป็น base64 แล้วส่งเป็น
  // JSON จะมีขนาดใหญ่กว่าไฟล์เดิมอีก ~33% ทำให้เกิน limit ขนาด request ของ serverless
  // function (Vercel จำกัดไว้ประมาณ 4.5MB) คำขออัปโหลดจะถูกปฏิเสธ "ก่อน" จะถึงโค้ดของเรา
  // ด้วยซ้ำ — หน้าเว็บเลยเห็นแค่ error ทั่วไปว่า "อัปโหลดไม่สำเร็จ" ไม่รู้สาเหตุจริง
  // แก้ด้วยการย่อขนาด + ลดคุณภาพก่อนส่งเสมอ ให้ไฟล์เล็กพอจะส่งผ่านได้ชัวร์
  async function compressImage(file: File, maxDim = 1600, quality = 0.72): Promise<string> {
    try {
      let bitmap: ImageBitmap
      try {
        // 'from-image' อ่านค่าการหมุนภาพจาก EXIF ให้อัตโนมัติ กันรูปจากมือถือหมุนเอียง
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      } catch {
        bitmap = await createImageBitmap(file)
      }
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no canvas context')
      ctx.drawImage(bitmap, 0, 0, w, h)
      return canvas.toDataURL('image/jpeg', quality)
    } catch {
      // เบราว์เซอร์เก่ามากๆ ไม่รองรับ canvas/createImageBitmap — ส่งไฟล์เดิมไปดื้อๆ ดีกว่าไม่ส่งเลย
      return toBase64(file)
    }
  }

  // ขั้นที่ 1: กดรับงาน (ไม่ต้องถ่ายรูป) — อัปเดตสถานะเป็น "กำลังไปหน้างาน"
  function handleAcceptJob() {
    updateStatus('heading')
  }

  // กด "บันทึก (เริ่มงาน)" — ต้องมีภาพก่อนติดตั้งอย่างน้อย 1 ภาพแล้ว (อัปโหลดทีละภาพไปแล้วตอนถ่าย)
  function handleStartWork() {
    if (beforePhotos.length === 0) return
    updateStatus('in_progress')
  }

  // อัปโหลดภาพหน้างาน/เอกสาร — บันทึกได้หลายไฟล์ต่อครั้ง (สูงสุด 20 ภาพต่อประเภท) เวลาบันทึกลง DB อัตโนมัติ (created_at)
  async function handleMultiUpload(files: FileList | null, docType: 'before_photo' | 'site_photo' | 'signed') {
    if (!files || files.length === 0) return
    const setUploading = docType === 'before_photo' ? setUploadingBefore : docType === 'site_photo' ? setUploadingSite : setUploadingDoc
    const setList = docType === 'before_photo' ? setBeforePhotos : docType === 'site_photo' ? setSitePhotos : setDocPhotos
    const currentList = docType === 'before_photo' ? beforePhotos : docType === 'site_photo' ? sitePhotos : docPhotos

    let fileList = Array.from(files)
    if (docType !== 'signed' && currentList.length + fileList.length > MAX_PHOTOS) {
      const remaining = Math.max(0, MAX_PHOTOS - currentList.length)
      if (remaining === 0) {
        setMsg(`❌ ถ่ายภาพครบ ${MAX_PHOTOS} ภาพแล้ว (สูงสุดต่อประเภท) ลบภาพเก่าก่อนถ้าต้องการถ่ายเพิ่ม`)
        return
      }
      setMsg(`⚠️ เลือกไว้ ${remaining} ภาพแรกเท่านั้น (ครบสูงสุด ${MAX_PHOTOS} ภาพต่อประเภทแล้ว)`)
      fileList = fileList.slice(0, remaining)
    }

    setUploading(true)
    setMsg('')
    let isFirstBeforePhoto = docType === 'before_photo' && currentList.length === 0
    for (const file of fileList) {
      try {
        const base64 = await compressImage(file)
        const label = docType === 'before_photo' ? 'ภาพก่อนติดตั้ง' : docType === 'site_photo' ? 'ภาพหน้างานเสร็จ' : 'เอกสารลูกค้าเซ็น'
        const res = await fetch('/api/jobs/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: job.id,
            name: `${label} ${new Date().toLocaleString('th-TH', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}`,
            base64, filename: file.name, doc_type: docType,
          }),
        })
        if (!res.ok) {
          // ตอบกลับไม่ใช่ 2xx (เช่น 413 Payload Too Large ถ้าไฟล์ยังใหญ่เกินไปแม้บีบอัดแล้ว)
          let detail = `HTTP ${res.status}`
          try { const errData = await res.json(); detail = errData.error || detail } catch { /* ไม่ใช่ JSON ก็ใช้ status code แทน */ }
          setMsg(`❌ อัปโหลด "${file.name}" ไม่สำเร็จ: ${detail}`)
          continue
        }
        const data = await res.json()
        if (data.data) {
          setList(prev => [...prev, data.data])
          // ภาพก่อนติดตั้งภาพแรก → บันทึกไว้ที่ jobs.start_photo_url ด้วย เผื่อหน้าแอดมินใช้แสดงภาพเดียว
          if (isFirstBeforePhoto) {
            isFirstBeforePhoto = false
            await fetch(`/api/jobs/${job.id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ start_photo_url: data.data.file_url }),
            }).catch(() => {})
          }
        } else setMsg(`❌ อัปโหลด "${file.name}" ไม่สำเร็จ: ${data.error || 'ไม่ทราบสาเหตุ'}`)
      } catch (err) {
        setMsg(`❌ อัปโหลด "${file.name}" ไม่สำเร็จ: ${err instanceof Error ? err.message : 'เชื่อมต่อไม่ได้ ลองเช็คสัญญาณอินเทอร์เน็ต'}`)
      }
    }
    setUploading(false)
  }

  const STATUS_COLOR: Record<string,{bg:string,color:string,label:string}> = {
    pending:     { bg:'#FAEEDA', color:'#854F0B', label:'รอเริ่ม' },
    assigned:    { bg:'#E6F1FB', color:'#185FA5', label:'มอบหมายแล้ว' },
    heading:     { bg:'#E6F1FB', color:'#185FA5', label:'กำลังไปหน้างาน' },
    in_progress: { bg:'#E1F5EE', color:'#0F6E56', label:'กำลังทำ' },
    completed:   { bg:'#EAF3DE', color:'#3B6D11', label:'เสร็จแล้ว' },
  }
  const sc = STATUS_COLOR[status] || STATUS_COLOR.pending

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden', borderLeft: `4px solid ${sc.color}` }}>
      {/* Summary row */}
      <div onClick={() => setShowDetail(!showDetail)} style={{ padding: '14px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0F2027' }}>{job.title}</div>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: sc.bg, color: sc.color, fontWeight: 700 }}>{sc.label}</span>
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>⏰ {job.scheduled_time?.slice(0,5)} · 📍 {cust?.address?.slice(0, 40)}</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>แตะเพื่อดูรายละเอียด {showDetail ? '▲' : '▼'}</div>
      </div>

      {/* Detail */}
      {showDetail && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ padding: '12px 0', fontSize: 13, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>👤 ลูกค้า: <strong>{cust?.name}</strong></div>
            <div>📱 โทร: <a href={`tel:${cust?.phone}`} style={{ color: '#0F6E56' }}>{cust?.phone}</a></div>
            <div>📍 {cust?.address}</div>
          </div>

          {/* ── แผนที่ + ปุ่มนำทาง ── */}
          {(() => {
            const lat = (job as unknown as { lat?: number }).lat
            const lng = (job as unknown as { lng?: number }).lng
            const mapsUrl = lat && lng
              ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
              : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cust?.address || '')}&travelmode=driving`
            const staticUrl = lat && lng && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
              ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x280&markers=color:red%7Clabel:★%7C${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
              : null
            return (
              <div style={{ marginBottom: 12 }}>
                {staticUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noreferrer">
                    <img src={staticUrl} alt="แผนที่" style={{ width: '100%', borderRadius: 10, display: 'block', marginBottom: 8 }} />
                  </a>
                ) : (
                  <div style={{ background: '#F0F4FF', borderRadius: 10, padding: 12, marginBottom: 8, fontSize: 12, color: '#555', textAlign: 'center' }}>
                    📍 {cust?.address}
                  </div>
                )}
                <a href={mapsUrl} target="_blank" rel="noreferrer" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  width: '100%', padding: '10px', background: '#185FA5', color: '#fff',
                  border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  boxSizing: 'border-box',
                }}>
                  🗺️ นำทางไปหน้างาน (Google Maps)
                </a>
              </div>
            )
          })()}

          {/* Action buttons */}
          {status === 'assigned' && (
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                กดรับงานนี้เพื่อแจ้งลูกค้าว่าช่างกำลังไปหน้างาน
              </div>
              <button onClick={handleAcceptJob} disabled={loading} style={{
                width: '100%', padding: '12px', background: '#0F6E56', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                {loading ? 'กำลังบันทึก...' : '✅ รับงาน'}
              </button>
            </div>
          )}

          {status === 'heading' && (
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 700 }}>
                📸 ภาพหน้างานก่อนติดตั้ง (บังคับอย่างน้อย 1 ภาพ ถ่ายได้สูงสุด {MAX_PHOTOS} ภาพ)
              </div>
              {beforePhotos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {beforePhotos.map(p => (
                    <div key={p.id} style={{ width: 72 }}>
                      <img src={p.file_url} alt={p.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
                      <div style={{ fontSize: 9, color: '#aaa', textAlign: 'center', marginTop: 2 }}>
                        {new Date(p.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input ref={beforePhotoRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }}
                onChange={e => { handleMultiUpload(e.target.files, 'before_photo'); e.target.value = '' }} />
              <button onClick={() => beforePhotoRef.current?.click()} disabled={uploadingBefore || beforePhotos.length >= MAX_PHOTOS} style={{
                width: '100%', padding: '12px', background: beforePhotos.length >= MAX_PHOTOS ? '#ccc' : '#185FA5', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: beforePhotos.length >= MAX_PHOTOS ? 'not-allowed' : 'pointer', marginBottom: 10,
              }}>
                {uploadingBefore ? '⏳ กำลังอัปโหลด...' : beforePhotos.length >= MAX_PHOTOS ? `ครบ ${MAX_PHOTOS} ภาพแล้ว` : `📷 ถ่ายรูปหน้างานก่อนติดตั้ง (${beforePhotos.length}/${MAX_PHOTOS})`}
              </button>
              <button onClick={handleStartWork} disabled={loading || beforePhotos.length === 0} style={{
                width: '100%', padding: '13px', background: beforePhotos.length === 0 ? '#ccc' : '#0F6E56', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800,
                cursor: beforePhotos.length === 0 ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'กำลังบันทึก...' : '💾 บันทึก (เริ่มงาน)'}
              </button>
              {beforePhotos.length === 0 && (
                <div style={{ fontSize: 11, color: '#A32D2D', textAlign: 'center', marginTop: 6 }}>
                  ต้องถ่ายรูปหน้างานก่อนเริ่มอย่างน้อย 1 ภาพก่อนกดบันทึก
                </div>
              )}
            </div>
          )}

          {status === 'in_progress' && (
            <div>
              {/* ภาพหน้างานที่ติดตั้งเสร็จ — บังคับอย่างน้อย 1 ภาพ */}
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 700 }}>
                📸 ภาพหน้างานที่ติดตั้งเสร็จ (บังคับ ถ่ายได้หลายภาพ)
              </div>
              {sitePhotos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {sitePhotos.map(p => (
                    <div key={p.id} style={{ width: 72 }}>
                      <img src={p.file_url} alt={p.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
                      <div style={{ fontSize: 9, color: '#aaa', textAlign: 'center', marginTop: 2 }}>
                        {new Date(p.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input ref={sitePhotoRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }}
                onChange={e => { handleMultiUpload(e.target.files, 'site_photo'); e.target.value = '' }} />
              <button onClick={() => sitePhotoRef.current?.click()} disabled={uploadingSite || sitePhotos.length >= MAX_PHOTOS} style={{
                width: '100%', padding: '12px', background: sitePhotos.length >= MAX_PHOTOS ? '#ccc' : '#3B6D11', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: sitePhotos.length >= MAX_PHOTOS ? 'not-allowed' : 'pointer', marginBottom: 16,
              }}>
                {uploadingSite ? '⏳ กำลังอัปโหลด...' : sitePhotos.length >= MAX_PHOTOS ? `ครบ ${MAX_PHOTOS} ภาพแล้ว` : `📷 ถ่ายรูปหน้างานเสร็จ (${sitePhotos.length}/${MAX_PHOTOS})`}
              </button>

              {/* เอกสาร/ใบงาน/Invoice ที่ลูกค้าเซ็นแล้ว — ไม่บังคับ แนบได้หลายไฟล์ */}
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 700 }}>
                📄 เอกสาร/ใบงาน/Invoice ที่ลูกค้าเซ็นแล้ว (ไม่บังคับ แนบได้หลายไฟล์)
              </div>
              {docPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {docPhotos.map(p => (
                    <div key={p.id} style={{ width: 72 }}>
                      <img src={p.file_url} alt={p.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
                      <div style={{ fontSize: 9, color: '#aaa', textAlign: 'center', marginTop: 2 }}>
                        {new Date(p.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input ref={docPhotoRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }}
                onChange={e => { handleMultiUpload(e.target.files, 'signed'); e.target.value = '' }} />
              <button onClick={() => docPhotoRef.current?.click()} disabled={uploadingDoc} style={{
                width: '100%', padding: '12px', background: '#185FA5', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 16,
              }}>
                {uploadingDoc ? '⏳ กำลังอัปโหลด...' : '📄 ถ่ายรูปเอกสารที่ลูกค้าเซ็น'}
              </button>

              <button onClick={() => updateStatus('completed')} disabled={loading || sitePhotos.length === 0} style={{
                width: '100%', padding: '13px', background: sitePhotos.length === 0 ? '#ccc' : '#0F6E56', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800,
                cursor: sitePhotos.length === 0 ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'กำลังบันทึก...' : '✅ เสร็จสิ้น'}
              </button>
              {sitePhotos.length === 0 && (
                <div style={{ fontSize: 11, color: '#A32D2D', textAlign: 'center', marginTop: 6 }}>
                  ต้องถ่ายภาพหน้างานเสร็จอย่างน้อย 1 ภาพก่อนกดเสร็จสิ้น
                </div>
              )}
            </div>
          )}

          {status === 'completed' && (
            <div>
              <div style={{ background: '#EAF3DE', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#3B6D11', textAlign: 'center', fontWeight: 600, marginBottom: 12 }}>
                ✅ งานเสร็จสมบูรณ์
              </div>
              {beforePhotos.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 700 }}>📸 ภาพก่อนติดตั้ง</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {beforePhotos.map(p => (
                      <img key={p.id} src={p.file_url} alt={p.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
                    ))}
                  </div>
                </div>
              )}
              {sitePhotos.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 700 }}>📸 ภาพหน้างานเสร็จ</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {sitePhotos.map(p => (
                      <img key={p.id} src={p.file_url} alt={p.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
                    ))}
                  </div>
                </div>
              )}
              {docPhotos.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 700 }}>📄 เอกสารที่ลูกค้าเซ็น</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {docPhotos.map(p => (
                      <img key={p.id} src={p.file_url} alt={p.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('✅') ? '#3B6D11' : '#A32D2D', textAlign: 'center' }}>{msg}</div>}
          {loading && <div style={{ marginTop: 8, fontSize: 12, color: '#888', textAlign: 'center' }}>กำลังบันทึก...</div>}
        </div>
      )}
    </div>
  )
}
