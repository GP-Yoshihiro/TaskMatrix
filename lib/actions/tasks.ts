'use server'

import { revalidatePath } from 'next/cache'
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

  revalidatePath(`/projects/${projectId}/tasks`)
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
      dueDate: normalizeDueDate(String(formData.get('dueDate') ?? '')),
    })
  } catch {
    return err('UNKNOWN', 'タスクを更新できませんでした。')
  }

  revalidatePath(`/projects/${projectId}/tasks`)
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

  revalidatePath(`/projects/${projectId}/tasks`)
  return ok(null)
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

  revalidatePath(`/projects/${projectId}/tasks`)
  return ok(null)
}
