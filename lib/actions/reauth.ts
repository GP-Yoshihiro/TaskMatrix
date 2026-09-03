'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { REAUTH_COOKIE, REAUTH_TTL_MS, buildReauthToken } from '@/lib/domain/reauth'
import { type Result, err, ok } from '@/lib/domain/result'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * 操作の直前に、パスワードでもう一度本人を確かめる。
 *
 * 確認は**使い捨てのクライアント**で行う。今のセッションで
 * ログインし直すと、確認しただけのつもりが token を入れ替えてしまう。
 */
export async function verifyPasswordAction(formData: FormData): Promise<Result<null>> {
  const password = String(formData.get('password') ?? '')
  if (password.length === 0) {
    return err('VALIDATION_ERROR', 'パスワードを入力してください。')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  if (!key) {
    return err('SERVICE_NOT_CONFIGURED', 'サーバーの設定が不足しているため確認できません。')
  }

  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { error } = await verifier.auth.signInWithPassword({ email: user.email, password })
  if (error) {
    if (error.status === 429) {
      return err('RATE_LIMITED', '試行が続いています。しばらく時間をおいてからお試しください。')
    }
    return err('VALIDATION_ERROR', 'パスワードが違います。')
  }

  const cookieStore = await cookies()
  cookieStore.set(REAUTH_COOKIE, buildReauthToken(user.id, new Date(), key), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/settings',
    maxAge: Math.floor(REAUTH_TTL_MS / 1000),
  })

  return ok(null)
}
