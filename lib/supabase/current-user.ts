import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * いま操作している利用者。
 *
 * `getUser()` は毎回 Supabase へ問い合わせる。1 回の画面表示で
 * レイアウトとページの両方が呼ぶと、同じ答えのために往復が 2 回になる。
 *
 * React の `cache` は**1 回の描画の中でだけ**結果を使い回す。
 * 要求をまたいで残らないため、別の利用者の情報が混ざることはない。
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
})
