import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { job_id, type, base64, filename } = body
  // type: 'start' | 'end'

  if (!job_id || !type || !base64) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Decode base64
  const buffer = Buffer.from(base64.split(',')[1] || base64, 'base64')
  const ext = filename?.split('.').pop() || 'jpg'
  const path = `jobs/${job_id}/${type}_${Date.now()}.${ext}`

  const { data: upload, error: uploadErr } = await supabaseAdmin
    .storage
    .from('job-photos')
    .upload(path, buffer, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: true,
    })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin
    .storage
    .from('job-photos')
    .getPublicUrl(path)

  // Update job record
  const field = type === 'start' ? 'start_photo_url' : 'end_photo_url'
  await supabaseAdmin.from('jobs').update({ [field]: publicUrl }).eq('id', job_id)

  return NextResponse.json({ data: { url: publicUrl, path: upload.path } })
}
