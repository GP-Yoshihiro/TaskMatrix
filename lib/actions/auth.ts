'use server'

import { redirect } from 'next/navigation'
import { describeAuthFailure, validateCredentials } from '@/lib/domain/auth'
import { normalizeCode } from '@/lib/domain/invitation'
import { type Result, err, ok } from '@/lib/domain/result'
import { createSupabaseInvitationRepository } from '@/lib/repositories/invitations'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceSupabaseClient } from '@/lib/supabase/service'
import { redeemInvitation } from '@/lib/usecases/redeem-invitation'

/**
 * 招待コードを使って登録する。
 *
 * ブラウザ用の登録 API は使わない。あのキーはクライアントに埋め込まれており、
 * 直接叩けば画面を通さず登録できてしまうため、照合が素通りになる。
 * サーバー専用キーで作ることで、Supabase 側の公開サインアップを
 * 無効にしたうえでも、この経路だけを残せる。
 */
export async function signUpAction(formData: FormData): Promise<Result<null>> {
  const validated = validateCredentials(
    String(formData.get('email') ?? ''),
    String(formData.get('password') ?? ''),
  )
  if (!validated.ok) return validated

  const code = normalizeCode(String(formData.get('inviteCode') ?? ''))
  if (code.length === 0) {
    return err('VALIDATION_ERROR', '招待コードを入力してください。')
  }

  const service = createServiceSupabaseClient()
  if (!service) {
    return err('SERVICE_NOT_CONFIGURED', 'サーバーの設定が不足しているため登録できません。')
  }

  const redeemed = await redeemInvitation(
    {
      repo: createSupabaseInvitationRepository(service),
      now: new Date(),
      // 招待コードで人を絞る前提のため、確認メールは経由しない
      createAccount: async ({ email, password }) => {
        const { data, error } = await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })

        if (error || !data.user) {
          if (error?.code === 'email_exists' || error?.status === 422) {
            return err(
              'VALIDATION_ERROR',
              'このメールアドレスは既に登録されています。ログイン画面からお進みください。',
            )
          }
          return { ok: false, error: describeAuthFailure(error) }
        }

        return ok({ userId: data.user.id })
      },
    },
    { code, email: validated.data.email, password: validated.data.password },
  )
  if (!redeemed.ok) return redeemed

  // 作成しただけでは未ログインのため、そのまま入れるようにする
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword(validated.data)
  if (error) {
    // アカウント自体はできている。作り直させてはいけない
    return err(
      'UNKNOWN',
      'アカウントは作成できましたが、ログインに失敗しました。ログイン画面からお試しください。',
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
    return { ok: false, error: describeAuthFailure(error) }
  }

  return ok(null)
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}
