'use server'

import { revalidatePath } from 'next/cache'
import {
  AI_USAGE_PATHS,
  type MutationKind,
  pathsToRefresh,
} from '@/lib/domain/revalidate-targets'
import type { SupabaseClient } from '@supabase/supabase-js'
import { type LimitReason, jstDateKey } from '@/lib/domain/limit-notification'
import { createSupabaseLimitNotificationRepository } from '@/lib/repositories/limit-notifications'
import { type Result, err, ok } from '@/lib/domain/result'
import type { WithUsage } from '@/lib/domain/usage'
import { isTaskPriority } from '@/lib/domain/tasks'
import { createOfficeParserExtractor } from '@/lib/extraction/text'
import { createGeminiTaskExtractor } from '@/lib/gemini/client'
import { createGeminiDuplicateFinder } from '@/lib/gemini/find-duplicates-client'
import {
  type MergedSuggestion,
  type SuggestionLike,
  applyGroups,
} from '@/lib/domain/merge-suggestions'
import { createSupabaseAiUsageRepository } from '@/lib/repositories/ai-usage'
import { createSupabaseExtractionRunRepository } from '@/lib/repositories/extraction-runs'
import { createSupabaseFileVersionRepository } from '@/lib/repositories/file-versions'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { type TaskSuggestion, extractTasksFromFile } from '@/lib/usecases/extract-tasks'
import { trackUsage } from '@/lib/usecases/track-usage'

const BUCKET = 'project-files'

/**
 * 上限に達したことを運用者へ知らせる役。
 *
 * 記録は本人の権限で行う。RLS により自分の分しか書けず、
 * 読めるのは本人と管理者だけになる。
 */
function createLimitNotifier(supabase: SupabaseClient, userId: string) {
  return async (reason: LimitReason) => {
    await createSupabaseLimitNotificationRepository(supabase).record({
      userId,
      reachedOn: jstDateKey(new Date()),
      reason,
    })
  }
}

/** 更新の影響が及ぶ画面をまとめて作り直す */
function refreshPages(kind: MutationKind, projectId: string): void {
  for (const path of pathsToRefresh(kind, projectId)) revalidatePath(path)
}

/**
 * AI を使ったあとに作り直す画面。
 *
 * 使用量の記録が増えるため、残量の表示が古いままにならないようにする。
 * 上限に達したときの知らせはホームに出る。
 */
function refreshAiUsage(): void {
  for (const path of AI_USAGE_PATHS) revalidatePath(path)
}

export async function extractTasksAction(
  formData: FormData,
): Promise<Result<WithUsage<{ suggestions: TaskSuggestion[]; summary: string }>>> {
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
    return await trackUsage(
      createSupabaseAiUsageRepository(supabase),
      { userId: user.id, projectId, operation: 'extract_tasks', onLimitReached: createLimitNotifier(supabase, user.id) },
      () =>
        extractTasksFromFile(
          {
            files: createSupabaseFileRepository(supabase),
            versions: createSupabaseFileVersionRepository(supabase),
            downloadBinary: async (storagePath) => {
              const { data, error } = await supabase.storage
                .from(BUCKET)
                .download(storagePath)
              if (error || !data) throw error ?? new Error('download failed')
              return new Uint8Array(await data.arrayBuffer())
            },
            textExtractor: createOfficeParserExtractor(),
            taskExtractor: createGeminiTaskExtractor(),
            runs: createSupabaseExtractionRunRepository(supabase),
          },
          { projectId, fileId, userId: user.id },
        ),
    )
  } catch {
    return err('UNKNOWN', 'タスク抽出に失敗しました。')
  }
}

/**
 * 複数の資料からまとめてタスクを抽出し、重複をまとめる。
 *
 * **AI の呼び出しは「資料の数 ＋ 1 回」。** 抽出が資料ごと、
 * 重複の判定にもう 1 回必要になる。いずれも 1 日の上限に算入される。
 *
 * 資料ごとに呼ぶのは、どの資料由来かを残すため。
 * 失敗しても、その資料だけをやり直せる。
 *
 * **まとめた結果はここでは保存しない。** 別の作業を誤ってまとめる危険があるため、
 * 画面で確かめてから登録してもらう。
 */
export async function extractTasksFromFilesAction(
  formData: FormData,
): Promise<
  Result<{
    suggestions: MergedSuggestion[]
    failures: { fileName: string; message: string }[]
    mergedGroupCount: number
  }>
> {
  const projectId = String(formData.get('projectId') ?? '')
  const raw = String(formData.get('fileIds') ?? '')

  let fileIds: string[]
  try {
    fileIds = JSON.parse(raw) as string[]
  } catch {
    return err('VALIDATION_ERROR', '対象のファイルを解釈できませんでした。')
  }

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return err('VALIDATION_ERROR', '抽出するファイルを選んでください。')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const files = createSupabaseFileRepository(supabase)
  const collected: SuggestionLike[] = []
  const failures: { fileName: string; message: string }[] = []

  for (const fileId of fileIds) {
    const file = await files.findById(fileId).catch(() => null)
    const fileName = file?.name ?? '(不明なファイル)'

    const single = new FormData()
    single.set('projectId', projectId)
    single.set('fileId', fileId)

    const result = await extractTasksAction(single)

    if (!result.ok) {
      // 1 つ失敗しても、残りは続ける。全部やり直させない
      failures.push({ fileName, message: result.error.message })
      continue
    }

    result.data.suggestions.forEach((suggestion, index) => {
      collected.push({
        ...suggestion,
        key: `${fileId}-${index}`,
        sourceFileName: fileName,
      })
    })
  }

  if (collected.length === 0) {
    return ok({ suggestions: [], failures, mergedGroupCount: 0 })
  }

  // 重複の判定。失敗しても抽出そのものは返す
  let groups: string[][] = []
  try {
    const found = await trackUsage(
      createSupabaseAiUsageRepository(supabase),
      {
        userId: user.id,
        projectId,
        operation: 'extract_tasks',
        onLimitReached: createLimitNotifier(supabase, user.id),
      },
      async () => {
        const result = await createGeminiDuplicateFinder().find(
          collected.map((item) => ({
            key: item.key,
            title: item.title,
            description: item.description,
          })),
        )
        if (!result.ok) return result
        return ok({ groups: result.data.groups, usage: result.data.usage })
      },
    )
    if (found.ok) groups = found.data.groups
  } catch {
    // まとめられなくても、抽出した一覧はそのまま使える
  }

  const suggestions = applyGroups(collected, groups)

  refreshPages('task', projectId)
  refreshAiUsage()

  return ok({
    suggestions,
    failures,
    mergedGroupCount: suggestions.filter((item) => item.mergedCount > 1).length,
  })
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
        estimatedDays: suggestion.estimatedDays,
        estimateSource: suggestion.estimateSource,
        origin: 'ai' as const,
        createdBy: user.id,
      })),
    )

    refreshPages('task', projectId)
    refreshAiUsage()
    return ok(count)
  } catch {
    return err('UNKNOWN', 'タスクを登録できませんでした。')
  }
}
