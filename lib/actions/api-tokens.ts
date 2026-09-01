'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { buildToken, displayPrefix, hashToken } from '@/lib/domain/api-token'
import { type Result, err, ok } from '@/lib/domain/result'
import { createSupabaseApiTokenRepository } from '@/lib/repositories/api-tokens'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** トークンの元になる乱数の長さ */
const TOKEN_BYTES = 32

const MAX_NAME_LENGTH = 60

/**
 * 連携トークンを発行する。
 *
 * 平文を返すのはこの 1 回だけ。保存するのはハッシュのみで、
 * 以降どこからも平文を取り出せない。
 */
export async function issueApiTokenAction(
  formData: FormData,
): Promise<Result<{ token: string }>> {
  const projectId = String(formData.get('projectId') ?? '')
  const name = String(formData.get('name') ?? '').trim().slice(0, MAX_NAME_LENGTH)

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')
  if (name.length === 0) return err('VALIDATION_ERROR', 'トークンの名前を入力してください。')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const token = buildToken(randomBytes(TOKEN_BYTES))

  try {
    await createSupabaseApiTokenRepository(supabase).create({
      projectId,
      userId: user.id,
      name,
      tokenHash: hashToken(token),
      displayPrefix: displayPrefix(token),
    })

    revalidatePath(`/projects/${projectId}`)
    return ok({ token })
  } catch {
    return err('UNKNOWN', 'トークンを発行できませんでした。')
  }
}

/** 連携トークンを失効させる。行を消すため、以後そのトークンは一切使えない */
export async function revokeApiTokenAction(
  formData: FormData,
): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const tokenId = String(formData.get('tokenId') ?? '')

  if (!tokenId) return err('VALIDATION_ERROR', 'トークンが指定されていません。')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    // 他人のトークンなら RLS により 0 件で、何も起きない
    await createSupabaseApiTokenRepository(supabase).deleteById(tokenId)

    revalidatePath(`/projects/${projectId}`)
    return ok(null)
  } catch {
    return err('UNKNOWN', 'トークンを失効できませんでした。')
  }
}
