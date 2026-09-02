'use server'

import type { Change } from '@/lib/domain/history'
import { HISTORY_PAGE_SIZE } from '@/lib/domain/history'
import { parseFilter } from '@/lib/domain/history-filter'
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

  const filter = parseFilter(
    new URLSearchParams({
      fileName: String(formData.get('fileName') ?? ''),
      extension: String(formData.get('extension') ?? ''),
      from: String(formData.get('from') ?? ''),
      to: String(formData.get('to') ?? ''),
      tag: String(formData.get('tag') ?? ''),
    }),
  )

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
      filter,
    })

    // 上限まで返ったなら、まだ続きがある可能性がある
    return ok({ entries, hasMore: entries.length === HISTORY_PAGE_SIZE })
  } catch {
    return err('UNKNOWN', '履歴を読み込めませんでした。')
  }
}

/**
 * 1 件の差分を取りに行く。
 *
 * 一覧には差分を載せない。全件分の変更行を積むと、
 * 無限スクロールで読み込む量が膨らみ、画面が重くなるため。
 */
export async function loadHistoryDetailAction(
  formData: FormData,
): Promise<Result<{ changes: Change[]; truncated: boolean }>> {
  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象が指定されていません。')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    // 他人のプロジェクトなら RLS により見つからない
    const detail = await createSupabaseHistoryRepository(supabase).findChanges(id)
    if (!detail) return err('NOT_FOUND', '変更内容が見つかりません。')

    return ok(detail)
  } catch {
    return err('UNKNOWN', '変更内容を読み込めませんでした。')
  }
}
