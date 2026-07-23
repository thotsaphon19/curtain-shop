import { supabaseAdmin } from './supabase'

interface LineLoginCredentials { clientId: string; clientSecret: string }

let cached: LineLoginCredentials | null = null
let cachedAt = 0
const CACHE_TTL_MS = 30_000 // 30 วิ — กด "บันทึก" ในหน้า Settings แล้วมีผลเกือบทันที ไม่ต้อง redeploy

export async function getLineLoginCredentials(): Promise<LineLoginCredentials> {
  const now = Date.now()
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached

  const { data } = await supabaseAdmin
    .from('line_login_settings').select('client_id, client_secret')
    .order('updated_at', { ascending: false }).limit(1).maybeSingle()

  cached = {
    clientId: data?.client_id || process.env.LINE_LOGIN_CLIENT_ID || '',
    clientSecret: data?.client_secret || process.env.LINE_LOGIN_CLIENT_SECRET || '',
  }
  cachedAt = now
  return cached
}

export function clearLineLoginCredentialsCache() {
  cached = null
  cachedAt = 0
}
