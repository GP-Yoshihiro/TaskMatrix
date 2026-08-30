'use server'

import { redirect } from 'next/navigation'
import { describeAuthFailure, validateCredentials } from '@/lib/domain/auth'
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
    if (error.code === 'user_already_exists' || error.status === 422) {
      return err(
        'VALIDATION_ERROR',
        'このメールアドレスは既に登録されています。ログイン画面からお進みください。',
      )
    }
    const described = describeAuthFailure(error)
    return { ok: false, error: described }
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
    return { ok: false, error: describeAuthFailure(error) }
  }

  return ok(null)
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}
