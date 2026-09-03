'use server'

import { matchesConfirmation } from '@/lib/domain/account'
import { type Result, err, ok } from '@/lib/domain/result'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceSupabaseClient } from '@/lib/supabase/service'

const BUCKET = 'project-files'

/**
 * アカウントを削除する。
 *
 * データベースは auth.users から profiles、その先のすべての表へ
 * 連鎖削除が設定されているため、利用者を消せば一緒に消える。
 *
 * **ただしストレージの実体は連鎖では消えない。**
 * 先に消さないと、参照する行が無くなって場所が分からなくなり、
 * 誰のものとも分からないファイルが残り続ける。
 */
export async function deleteAccountAction(formData: FormData): Promise<Result<null>> {
  const confirmation = String(formData.get('confirmation') ?? '')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  // 本人のメールアドレスと一致しなければ実行しない
  if (!matchesConfirmation(confirmation, user.email ?? '')) {
    return err(
      'VALIDATION_ERROR',
      'メールアドレスが一致しません。削除は実行していません。',
    )
  }

  const service = createServiceSupabaseClient()
  if (!service) {
    return err('SERVICE_NOT_CONFIGURED', 'サーバーの設定が不足しているため実行できません。')
  }

  try {
    // 1. ストレージの実体を先に消す（連鎖では消えないため）
    const { data: rows } = await service
      .from('file_versions')
      .select('storage_path, files!inner(project_id, projects!inner(owner_id))')
      .eq('files.projects.owner_id', user.id)
      .not('storage_path', 'is', null)

    const paths = ((rows ?? []) as { storage_path: string | null }[])
      .map((row) => row.storage_path)
      .filter((path): path is string => Boolean(path))

    if (paths.length > 0) {
      await service.storage.from(BUCKET).remove(paths)
    }

    // 2. 利用者を消す。ここから先はすべて連鎖で消える
    const { error } = await service.auth.admin.deleteUser(user.id)
    if (error) throw error
  } catch {
    return err('UNKNOWN', 'アカウントを削除できませんでした。')
  }

  // 3. 手元のセッションも破棄する。残すと消えたアカウントのまま操作できてしまう
  try {
    await supabase.auth.signOut()
  } catch {
    // 破棄できなくても、アカウント自体は消えている
  }

  return ok(null)
}
