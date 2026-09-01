import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * サーバー専用キーで接続するクライアント。
 *
 * トークン認証の API はセッションを持たないため、RLS を効かせる相手がいない。
 * このクライアントは RLS を通らないため、呼び出し側が必ず
 * トークンの project_id で問い合わせを絞ること。
 *
 * キーが無ければ例外ではなく null を返す。
 * 呼び出し側が 503 を返して「設定不備」だと伝えられるようにするため。
 * このキーはクライアントへ露出させない（R-14）。
 */
export function createServiceSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return null

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
