'use server'

import { HISTORY_PAGE_SIZE } from '@/lib/domain/history'
import { type Result, err, ok } from '@/lib/domain/result'
import {
  type HistoryEntry,
  createSupabaseHistoryRepository,
} from '@/lib/repositories/history'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** 続きを読む。プロジェクト始動時まで遡れる */
export async function loadMoreHistoryAction(
  formData: FormData,
): Promise<Result<{ entries: HistoryEntry[]; hasMore: boolean }>> {
  const projectId = String(formData.get('projectId') ?? '')
  const order = String(formData.get('order') ?? 'desc') === 'asc' ? 'asc' : 'desc'
  const cursorCreatedAt = String(formData.get('cursorCreatedAt') ?? '')
  const cursorId = String(formData.get('cursorId') ?? '')

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    const entries = await createSupabaseHistoryRepository(supabase).listByProject({
      projectId,
      order,
      limit: HISTORY_PAGE_SIZE,
      cursor:
        cursorCreatedAt && cursorId
          ? { createdAt: cursorCreatedAt, id: cursorId }
          : undefined,
    })

    // 上限まで返ったなら、まだ続きがある可能性がある
    return ok({ entries, hasMore: entries.length === HISTORY_PAGE_SIZE })
  } catch {
    return err('UNKNOWN', '履歴を読み込めませんでした。')
  }
}
