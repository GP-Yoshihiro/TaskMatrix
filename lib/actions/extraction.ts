'use server'

import { revalidatePath } from 'next/cache'
import { type Result, err, ok } from '@/lib/domain/result'
import { isTaskPriority } from '@/lib/domain/tasks'
import { createOfficeParserExtractor } from '@/lib/extraction/text'
import { createGeminiTaskExtractor } from '@/lib/gemini/client'
import { createSupabaseExtractionRunRepository } from '@/lib/repositories/extraction-runs'
import { createSupabaseFileVersionRepository } from '@/lib/repositories/file-versions'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { type TaskSuggestion, extractTasksFromFile } from '@/lib/usecases/extract-tasks'

const BUCKET = 'project-files'

export async function extractTasksAction(
  formData: FormData,
): Promise<Result<{ suggestions: TaskSuggestion[]; summary: string }>> {
  const projectId = String(formData.get('projectId') ?? '')
  const fileId = String(formData.get('fileId') ?? '')
  if (!projectId || !fileId) {
    return err('VALIDATION_ERROR', '対象のファイルが指定されていません。')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    return await extractTasksFromFile(
      {
        files: createSupabaseFileRepository(supabase),
        versions: createSupabaseFileVersionRepository(supabase),
        downloadBinary: async (storagePath) => {
          const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
          if (error || !data) throw error ?? new Error('download failed')
          return new Uint8Array(await data.arrayBuffer())
        },
        textExtractor: createOfficeParserExtractor(),
        taskExtractor: createGeminiTaskExtractor(),
        runs: createSupabaseExtractionRunRepository(supabase),
      },
      { projectId, fileId, userId: user.id },
    )
  } catch {
    return err('UNKNOWN', 'タスク抽出に失敗しました。')
  }
}

export async function registerTasksAction(formData: FormData): Promise<Result<number>> {
  const projectId = String(formData.get('projectId') ?? '')
  const fileId = String(formData.get('fileId') ?? '')
  const sourceVersionRaw = String(formData.get('sourceVersion') ?? '')
  const payload = String(formData.get('suggestions') ?? '[]')

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  let suggestions: TaskSuggestion[]
  try {
    suggestions = JSON.parse(payload) as TaskSuggestion[]
  } catch {
    return err('VALIDATION_ERROR', '登録するタスクを解釈できませんでした。')
  }

  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return err('VALIDATION_ERROR', '登録するタスクを選んでください。')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    const count = await createSupabaseTaskRepository(supabase).createMany(
      suggestions.map((suggestion) => ({
        projectId,
        sourceFileId: fileId || null,
        sourceVersion: sourceVersionRaw ? Number(sourceVersionRaw) : null,
        title: suggestion.title,
        description: suggestion.description,
        priority: isTaskPriority(suggestion.priority) ? suggestion.priority : 'medium',
        assignee: suggestion.assignee,
        dueDate: suggestion.dueDate,
        ambiguityNote: suggestion.ambiguityNote,
        aiSuggestion: suggestion.aiSuggestion,
        origin: 'ai' as const,
        createdBy: user.id,
      })),
    )

    revalidatePath(`/projects/${projectId}/tasks`)
    return ok(count)
  } catch {
    return err('UNKNOWN', 'タスクを登録できませんでした。')
  }
}
