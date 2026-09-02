'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { validateDisplayName } from '@/lib/domain/profile'
import { type Result, err, ok } from '@/lib/domain/result'
import { THEME_COOKIE_NAME, type ThemePreference } from '@/lib/platform/theme'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const VALID: ThemePreference[] = ['auto', 'apple', 'windows']

export async function updateThemeAction(formData: FormData): Promise<Result<null>> {
  const value = String(formData.get('theme') ?? '') as ThemePreference

  if (!VALID.includes(value)) {
    return err('VALIDATION_ERROR', '不正なテーマが指定されました。')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const { error } = await supabase.from('profiles').update({ theme: value }).eq('id', user.id)

  if (error) return err('UNKNOWN', 'テーマを保存できませんでした。')

  const cookieStore = await cookies()
  cookieStore.set(THEME_COOKIE_NAME, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  revalidatePath('/', 'layout')
  return ok(null)
}

/** 履歴の変更者名に使う表示名を保存する */
export async function updateDisplayNameAction(
  formData: FormData,
): Promise<Result<null>> {
  const value = String(formData.get('displayName') ?? '').trim()

  const message = validateDisplayName(value)
  if (message) return err('VALIDATION_ERROR', message)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: value })
    .eq('id', user.id)

  if (error) return err('UNKNOWN', '表示名を保存できませんでした。')

  revalidatePath('/settings')
  return ok(null)
}
