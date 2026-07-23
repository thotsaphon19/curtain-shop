import { supabaseAdmin } from './supabase'

export async function createWebNotification(opts: {
  type: string
  title: string
  message?: string
  link?: string
}) {
  try {
    await supabaseAdmin.from('web_notifications').insert({
      type: opts.type, title: opts.title, message: opts.message || null, link: opts.link || null,
    })
  } catch (err) {
    console.error('[web-notification] error:', err instanceof Error ? err.message : err)
  }
}
