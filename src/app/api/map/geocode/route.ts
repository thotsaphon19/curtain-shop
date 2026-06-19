import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/maps'
export const dynamic = 'force-dynamic'

// Geocode a single address or re-geocode all jobs without coordinates
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Single address
  if (body.address) {
    const coords = await geocodeAddress(body.address)
    if (!coords) return NextResponse.json({ error: 'ไม่พบพิกัด' }, { status: 404 })
    // optionally save to job
    if (body.job_id) {
      await supabaseAdmin.from('jobs').update({ lat: coords.lat, lng: coords.lng, geocoded_at: new Date().toISOString() }).eq('id', body.job_id)
    }
    return NextResponse.json({ data: coords })
  }

  // Batch: geocode all jobs missing coords
  if (body.batch) {
    const { data: jobs } = await supabaseAdmin.from('jobs').select('id, address').or('lat.is.null,lng.is.null').limit(50)
    const results: {id: string; success: boolean}[] = []
    for (const job of jobs || []) {
      if (!job.address) continue
      const coords = await geocodeAddress(job.address)
      if (coords) {
        await supabaseAdmin.from('jobs').update({ lat: coords.lat, lng: coords.lng, geocoded_at: new Date().toISOString() }).eq('id', job.id)
        results.push({ id: job.id, success: true })
      } else {
        results.push({ id: job.id, success: false })
      }
    }
    return NextResponse.json({ data: results })
  }

  return NextResponse.json({ error: 'address or batch required' }, { status: 400 })
}
