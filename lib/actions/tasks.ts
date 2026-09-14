'use server'

import { revalidatePath } from 'next/cache'
import { type MutationKind, pathsToRefresh } from '@/lib/domain/revalidate-targets'
import { parseEstimatedDays } from '@/lib/domain/estimate-days'
import { type Result, err, ok } from '@/lib/domain/result'
import {
  isTaskPriority,
  isTaskStatus,
  normalizeDueDate,
  validateTaskTitle,
} from '@/lib/domain/tasks'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function context() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/** 更新の影響が及ぶ画面をまとめて作り直す */
function refreshPages(kind: MutationKind, projectId: string): void {
  for (const path of pathsToRefresh(kind, projectId)) revalidatePath(path)
}

export async function createTaskAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const validated = validateTaskTitle(String(formData.get('title') ?? ''))
  if (!validated.ok) return validated

  const priorityRaw = String(formData.get('priority') ?? 'medium')
  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseTaskRepository(supabase).createMany([
      {
        projectId,
        sourceFileId: null,
        sourceVersion: null,
        title: validated.data,
        description: String(formData.get('description') ?? ''),
        priority: isTaskPriority(priorityRaw) ? priorityRaw : 'medium',
        assignee: String(formData.get('assignee') ?? ''),
        // 空文字は「選ばない」。null で保存し、自由入力に任せる
        assigneeMemberId: String(formData.get('assigneeMemberId') ?? '') || null,
        estimatedDays: parseEstimatedDays(String(formData.get('estimatedDays') ?? '')),
        // 手で入れた値は、資料の記載でも AI の推定でもない
        estimateSource: '',
        dueDate: normalizeDueDate(String(formData.get('dueDate') ?? '')),
        ambiguityNote: '',
        aiSuggestion: '',
        origin: 'manual',
        createdBy: user.id,
      },
    ])
  } catch {
    return err('UNKNOWN', 'タスクを作成できませんでした。')
  }

  refreshPages('task', projectId)
  return ok(null)
}

export async function updateTaskAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のタスクが指定されていません。')

  const validated = validateTaskTitle(String(formData.get('title') ?? ''))
  if (!validated.ok) return validated

  const priorityRaw = String(formData.get('priority') ?? 'medium')
  const statusRaw = String(formData.get('status') ?? 'todo')

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseTaskRepository(supabase).update(id, {
      title: validated.data,
      description: String(formData.get('description') ?? ''),
      priority: isTaskPriority(priorityRaw) ? priorityRaw : 'medium',
      status: isTaskStatus(statusRaw) ? statusRaw : 'todo',
      assignee: String(formData.get('assignee') ?? ''),
      assigneeMemberId: String(formData.get('assigneeMemberId') ?? '') || null,
      estimatedDays: parseEstimatedDays(String(formData.get('estimatedDays') ?? '')),
      // 手で入れた値は、資料の記載でも AI の推定でもない
      estimateSource: '',
      dueDate: normalizeDueDate(String(formData.get('dueDate') ?? '')),
    })
  } catch {
    return err('UNKNOWN', 'タスクを更新できませんでした。')
  }

  refreshPages('task', projectId)
  return ok(null)
}

export async function moveTaskAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const id = String(formData.get('id') ?? '')
  const statusRaw = String(formData.get('status') ?? '')

  if (!id || !isTaskStatus(statusRaw)) {
    return err('VALIDATION_ERROR', '移動先が正しくありません。')
  }

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseTaskRepository(supabase).update(id, { status: statusRaw })
  } catch {
    return err('UNKNOWN', 'タスクを移動できませんでした。')
  }

  refreshPages('task', projectId)
  return ok(null)
}

/**
 * 選んだタスクをまとめて消す。
 *
 * 消せた件数を返す。求めた数と違えば、画面でその旨を伝えられる。
 * （行レベルセキュリティにより、他人のタスクは消えない）
 */
export async function deleteTasksAction(formData: FormData): Promise<Result<number>> {
  const projectId = String(formData.get('projectId') ?? '')
  const raw = String(formData.get('ids') ?? '')

  let ids: string[]
  try {
    ids = JSON.parse(raw) as string[]
  } catch {
    return err('VALIDATION_ERROR', '対象のタスクを解釈できませんでした。')
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return err('VALIDATION_ERROR', '削除するタスクを選んでください。')
  }

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  let removed = 0
  try {
    removed = await createSupabaseTaskRepository(supabase).removeMany(ids)
  } catch {
    return err('UNKNOWN', 'タスクを削除できませんでした。')
  }

  refreshPages('task', projectId)
  return ok(removed)
}

export async function deleteTaskAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のタスクが指定されていません。')

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseTaskRepository(supabase).remove(id)
  } catch {
    return err('UNKNOWN', 'タスクを削除できませんでした。')
  }

  refreshPages('task', projectId)
  return ok(null)
}
