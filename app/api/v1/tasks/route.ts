import type { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/api/authenticate'
import { apiError, apiOk } from '@/lib/api/respond'
import { isTaskPriority, normalizeDueDate } from '@/lib/domain/tasks'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'

/** タスク名の上限。ショートカットからの誤送信で巨大な本文が入るのを防ぐ */
const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 2000

/**
 * ショートカットからタスクを追加する。
 *
 * プロジェクトはトークンが決める。**本文からは受け取らない。**
 * 受け取れるようにすると「他人のプロジェクト ID を指定する」攻撃が成立してしまう。
 */
export async function POST(request: NextRequest) {
  const authenticated = await authenticateRequest(request)
  if ('auth' in authenticated === false) return authenticated

  const { auth, supabase } = authenticated

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return apiError(
      { code: 'VALIDATION_ERROR', message: '本文を解釈できませんでした。' },
      400,
    )
  }

  const title = String(body.title ?? '').trim()
  if (title.length === 0) {
    return apiError(
      { code: 'VALIDATION_ERROR', message: 'タスク名を指定してください。' },
      400,
    )
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return apiError(
      {
        code: 'VALIDATION_ERROR',
        message: `タスク名は ${MAX_TITLE_LENGTH} 文字以内で指定してください。`,
      },
      400,
    )
  }

  const priorityRaw = String(body.priority ?? 'medium')
  const description = String(body.description ?? '').slice(0, MAX_DESCRIPTION_LENGTH)

  try {
    const created = await createSupabaseTaskRepository(supabase).createMany([
      {
        // 操作範囲はトークンが決める
        projectId: auth.projectId,
        sourceFileId: null,
        sourceVersion: null,
        title,
        description,
        priority: isTaskPriority(priorityRaw) ? priorityRaw : 'medium',
        assignee: String(body.assignee ?? ''),
        dueDate: normalizeDueDate(String(body.dueDate ?? '')),
        ambiguityNote: '',
        aiSuggestion: '',
        origin: 'manual',
        createdBy: auth.userId,
      },
    ])

    return apiOk(
      {
        created,
        title,
        // ショートカットでそのまま読み上げに使えるようにする
        message: `「${title}」を追加しました。`,
      },
      201,
    )
  } catch {
    return apiError(
      { code: 'UNKNOWN', message: 'タスクを追加できませんでした。' },
      500,
    )
  }
}
