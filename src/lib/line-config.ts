import { supabaseAdmin } from './supabase'

// ── ดึงค่า LINE OA (Channel Access Token / Channel Secret) ────────────────────
// รองรับหลายบัญชี (multi-OA): ระบุ oaAccountId เพื่อใช้บัญชีนั้นเฉพาะเจาะจง
// ถ้าไม่ระบุ (undefined/null) จะ fallback ไปที่บัญชี default ใน line_oa_accounts
// แล้วจึงค่อย fallback ไปที่ค่าเดิมในหน้า Settings เดี่ยว (line_oa_settings) และ env var ตามลำดับ
// แคชไว้ในหน่วยความจำสั้นๆ กันยิง DB ถี่เกินไปตอนส่งแจ้งเตือนหลายรายการรวดเดียว
interface LineOACredentials { token: string; secret: string }

const cache = new Map<string, { data: LineOACredentials; at: number }>()
const CACHE_TTL_MS = 30_000

export async function getLineOACredentials(oaAccountId?: string | null): Promise<LineOACredentials> {
  const cacheKey = oaAccountId || '__default__'
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data

  let creds: LineOACredentials | null = null

  // 1) บัญชีที่ระบุเจาะจง
  if (oaAccountId) {
    const { data } = await supabaseAdmin
      .from('line_oa_accounts')
      .select('channel_access_token, channel_secret')
      .eq('id', oaAccountId).eq('active', true).maybeSingle()
    if (data) creds = { token: data.channel_access_token, secret: data.channel_secret }
  }

  // 2) บัญชี default ในตาราง multi-OA
  if (!creds) {
    const { data } = await supabaseAdmin
      .from('line_oa_accounts')
      .select('channel_access_token, channel_secret')
      .eq('is_default', true).eq('active', true).maybeSingle()
    if (data) creds = { token: data.channel_access_token, secret: data.channel_secret }
  }

  // 3) ค่าเดิมจากหน้า Settings เดี่ยว (ก่อนมี multi-OA) / env var — เผื่อยังไม่ได้ migrate
  if (!creds) {
    const { data } = await supabaseAdmin
      .from('line_oa_settings').select('channel_access_token, channel_secret')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle()
    creds = {
      token: data?.channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
      secret: data?.channel_secret || process.env.LINE_CHANNEL_SECRET || '',
    }
  }

  cache.set(cacheKey, { data: creds, at: Date.now() })
  return creds
}

// หา oa_account_id ของบัญชี default (ใช้ตอน webhook หลักไม่มี oaId ใน path)
export async function getDefaultOAAccountId(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('line_oa_accounts').select('id').eq('is_default', true).eq('active', true).maybeSingle()
  return data?.id || null
}

// เรียกหลังบันทึกค่าใหม่จากหน้า Settings เพื่อให้ผลทันทีโดยไม่ต้องรอ cache หมดอายุ
export function clearLineOACredentialsCache() {
  cache.clear()
}
