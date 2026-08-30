'use server'

import { redirect } from 'next/navigation'
import { validateCredentials } from '@/lib/domain/auth'
import { type Result, err, ok } from '@/lib/domain/result'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function signUpAction(formData: FormData): Promise<Result<null>> {
  const validated = validateCredentials(
    String(formData.get('email') ?? ''),
    String(formData.get('password') ?? ''),
  )
  if (!validated.ok) return validated

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signUp(validated.data)

  if (error) {
    return err(
      'VALIDATION_ERROR',
      'アカウントを作成できませんでした。入力内容をご確認ください。',
    )
  }

  return ok(null)
}

export async function signInAction(formData: FormData): Promise<Result<null>> {
  const validated = validateCredentials(
    String(formData.get('email') ?? ''),
    String(formData.get('password') ?? ''),
  )
  if (!validated.ok) return validated

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword(validated.data)

  if (error) {
    return err('UNAUTHENTICATED', 'メールアドレスまたはパスワードが正しくありません。')
  }

  return ok(null)
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}
