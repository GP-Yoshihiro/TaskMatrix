'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { encryptSecret } from '@/lib/domain/crypto'
import {
  DEFAULT_EXPIRY_DAYS,
  buildCode,
  displayPrefix,
  expiresAt,
  hashCode,
} from '@/lib/domain/invitation'
import { type Result, err, ok } from '@/lib/domain/result'
import { REAUTH_COOKIE, verifyReauthToken } from '@/lib/domain/reauth'
import { createSupabaseInvitationRepository } from '@/lib/repositories/invitations'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { type RevealedInvitation, revealInvitations } from '@/lib/usecases/reveal-invitations'

/** コードの元になる乱数の長さ */
const CODE_BYTES = 16

const MAX_NOTE_LENGTH = 60

/**
 * 管理者であり、かつ直前にパスワードを確認済みであること。
 *
 * 画面側だけで止めても意味がない。この関数を通らない経路から
 * 直接呼ばれれば素通りするため、サーバー側で必ず確かめる。
 */
async function requireAdmin(): Promise<Result<{ userId: string }>> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return err('FORBIDDEN', '招待コードを発行できるのは管理者のみです。')
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(REAUTH_COOKIE)?.value ?? ''

  if (
    !verifyReauthToken(token, user.id, new Date(), process.env.GOOGLE_TOKEN_ENCRYPTION_KEY)
  ) {
    return err('UNAUTHENTICATED', 'パスワードの確認が必要です。')
  }

  return ok({ userId: user.id })
}

/**
 * 発行済みコードの全文を返す。
 *
 * 画面の初期表示には含めない。含めると、パスワードを確認する前に
 * すでに手元へ届いてしまい、伏せているだけの見せかけになる。
 */
export async function revealInvitationCodesAction(): Promise<Result<RevealedInvitation[]>> {
  const admin = await requireAdmin()
  if (!admin.ok) return admin

  try {
    const supabase = await createServerSupabaseClient()
    const stored = await createSupabaseInvitationRepository(supabase).listByCreator(
      admin.data.userId,
    )

    return ok(revealInvitations(stored, process.env.GOOGLE_TOKEN_ENCRYPTION_KEY))
  } catch {
    return err('UNKNOWN', '招待コードを読み出せませんでした。')
  }
}

/**
 * 招待コードを発行する。
 *
 * 平文を返すのはこの 1 回だけ。保存するのはハッシュのみで、
 * 以降どこからも平文を取り出せない。紛失時は無効化して再発行する。
 */
export async function issueInvitationAction(
  formData: FormData,
): Promise<Result<{ code: string }>> {
  const admin = await requireAdmin()
  if (!admin.ok) return admin

  const note = String(formData.get('note') ?? '')
    .trim()
    .slice(0, MAX_NOTE_LENGTH)

  const code = buildCode(randomBytes(CODE_BYTES))

  // 読み返せるように暗号化して持つ。鍵はデータベースの外に置く
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  if (!key) {
    return err('SERVICE_NOT_CONFIGURED', 'サーバーの設定が不足しているため発行できません。')
  }

  try {
    const supabase = await createServerSupabaseClient()
    await createSupabaseInvitationRepository(supabase).create({
      codeHash: hashCode(code),
      codeEncrypted: encryptSecret(code, key),
      displayPrefix: displayPrefix(code),
      note,
      createdBy: admin.data.userId,
      expiresAt: expiresAt(new Date(), DEFAULT_EXPIRY_DAYS),
    })

    revalidatePath('/settings/invitations')
    return ok({ code })
  } catch {
    return err('UNKNOWN', '招待コードを発行できませんでした。')
  }
}

/** 招待コードを無効にする。使用済みのものは記録を残すため触らない */
export async function revokeInvitationAction(formData: FormData): Promise<Result<null>> {
  const admin = await requireAdmin()
  if (!admin.ok) return admin

  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象が指定されていません。')

  try {
    const supabase = await createServerSupabaseClient()
    await createSupabaseInvitationRepository(supabase).revoke(id, new Date().toISOString())

    revalidatePath('/settings/invitations')
    return ok(null)
  } catch {
    return err('UNKNOWN', '招待コードを無効にできませんでした。')
  }
}
