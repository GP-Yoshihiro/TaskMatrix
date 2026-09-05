'use server'

import { revalidatePath } from 'next/cache'
import { type Result, err, ok } from '@/lib/domain/result'
import { createSupabaseLimitNotificationRepository } from '@/lib/repositories/limit-notifications'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * 知らせを確認済みにする。
 *
 * 確認できるのは管理者のみ。RLS の update ポリシーでも同じ条件を課しており、
 * ここを迂回して呼ばれても書き換えられない。
 */
export async function markLimitNoticesReadAction(): Promise<Result<null>> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseLimitNotificationRepository(supabase).markAllRead()
  } catch {
    return err('UNKNOWN', '確認済みにできませんでした。')
  }

  revalidatePath('/dashboard')
  return ok(null)
}
