import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

// GET /api/jobs/documents?job_id=xxx
export async function GET(req: NextRequest) {
  const jobId = new URL(req.url).searchParams.get('job_id')
  if (!jobId) return NextResponse.json({ error: 'job_id required' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('job_documents').select('*').eq('job_id', jobId).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

// POST /api/jobs/documents — อัปโหลดไฟล์เอกสาร
export async function POST(req: NextRequest) {
  const session = await getSession()
  const body = await req.json()
  const { job_id, name, base64, filename, doc_type = 'other' } = body

  if (!job_id || !base64 || !filename)
    return NextResponse.json({ error: 'job_id, base64, filename required' }, { status: 400 })

  const ext = filename.split('.').pop()?.toLowerCase() || 'bin'
  const isPdf = ext === 'pdf'
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)

  if (!isPdf && !isImage)
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ รูปภาพ (jpg/png/webp) และ PDF เท่านั้น' }, { status: 400 })

  const fileType = isPdf ? 'pdf' : 'image'
  const contentType = isPdf ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`

  // Decode base64
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64
  const buffer = Buffer.from(base64Data, 'base64')
  const fileSizeKB = Math.round(buffer.length / 1024)

  if (buffer.length > 15 * 1024 * 1024)
    return NextResponse.json({ error: 'ไฟล์ใหญ่เกินไป (สูงสุด 15 MB)' }, { status: 400 })

  const path = `jobs/${job_id}/docs/${Date.now()}_${filename.replace(/\s+/g, '_')}`

  const { error: uploadErr } = await supabaseAdmin.storage
    .from('job-documents')
    .upload(path, buffer, { contentType, upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage.from('job-documents').getPublicUrl(path)

  const { data, error } = await supabaseAdmin.from('job_documents').insert({
    job_id,
    name: name || filename,
    file_url: publicUrl,
    file_path: path,
    file_type: fileType,
    file_size: fileSizeKB,
    doc_type,
    uploaded_by: session?.display_name || 'ระบบ',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

// DELETE /api/jobs/documents?id=xxx
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: doc } = await supabaseAdmin.from('job_documents').select('file_path').eq('id', id).single()
  if (doc?.file_path) {
    await supabaseAdmin.storage.from('job-documents').remove([doc.file_path])
  }

  const { error } = await supabaseAdmin.from('job_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'deleted' })
}
