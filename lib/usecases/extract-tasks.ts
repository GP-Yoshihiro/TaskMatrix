import {
  looksLikeScannedPdf,
  preprocessText,
  validateExtractedText,
} from '@/lib/domain/extraction'
import { getExtension } from '@/lib/domain/files'
import { type AppError, type Result, err, ok } from '@/lib/domain/result'
import type { AiUsage } from '@/lib/domain/usage'
import { type TaskPriority, isTaskPriority, normalizeDueDate } from '@/lib/domain/tasks'
import type { TextExtractor } from '@/lib/extraction/text'
import type { TaskExtractor } from '@/lib/gemini/client'
import type { ExtractionRunRepository } from '@/lib/repositories/extraction-runs'
import type { FileVersionRepository } from '@/lib/repositories/file-versions'
import type { FileRepository } from '@/lib/repositories/files'

export type TaskSuggestion = {
  title: string
  description: string
  priority: TaskPriority
  assignee: string
  dueDate: string | null
  ambiguityNote: string
  aiSuggestion: string
}

type Deps = {
  files: FileRepository
  versions: FileVersionRepository
  downloadBinary: (storagePath: string) => Promise<Uint8Array>
  textExtractor: TextExtractor
  taskExtractor: TaskExtractor
  runs: ExtractionRunRepository
}

/**
 * ファイルからタスク候補を抽出する。
 *
 * ここではタスクを保存しない。保存はユーザーが提案を選択したあとに行う。
 * 再抽出しても既存のタスクが失われないようにするための設計。
 */
export async function extractTasksFromFile(
  deps: Deps,
  input: { projectId: string; fileId: string; userId: string },
): Promise<Result<{ suggestions: TaskSuggestion[]; summary: string; usage: AiUsage }>> {
  const file = await deps.files.findById(input.fileId)
  if (!file) return err('NOT_FOUND', 'ファイルが見つかりません。')

  const run = await deps.runs.start({
    projectId: input.projectId,
    fileId: file.id,
    fileVersion: file.currentVersion,
    userId: input.userId,
  })

  const failWith = async (error: AppError): Promise<Result<never>> => {
    await deps.runs.fail({ runId: run.id, errorMessage: `${error.code}: ${error.message}` })
    return { ok: false, error }
  }

  // 本文を取得する
  let rawText = ''
  let pdfBuffer: Uint8Array | null = null

  if (file.kind === 'binary') {
    if (!file.storagePath) {
      return failWith({
        code: 'TEXT_EXTRACTION_FAILED',
        message: 'ファイルからテキストを取り出せませんでした。',
      })
    }
    const buffer = await deps.downloadBinary(file.storagePath)
    rawText = await deps.textExtractor.extract({ buffer, filename: file.name })
    if (looksLikeScannedPdf(rawText, getExtension(file.name))) {
      pdfBuffer = buffer
    }
  } else {
    const version = await deps.versions.findByVersion(file.id, file.currentVersion)
    rawText = version?.content ?? ''
  }

  const text = preprocessText(rawText)

  // スキャン PDF は本体を送るため、テキストの妥当性検証を飛ばす
  if (!pdfBuffer) {
    const validated = validateExtractedText(text)
    if (!validated.ok) return failWith(validated.error)
  }

  const extracted = await deps.taskExtractor.extract(
    pdfBuffer ? { pdf: pdfBuffer } : { text },
  )
  if (!extracted.ok) return failWith(extracted.error)

  const suggestions: TaskSuggestion[] = extracted.data.tasks.map((task) => ({
    title: task.title,
    description: task.description,
    priority: isTaskPriority(task.priority) ? task.priority : 'medium',
    assignee: task.assignee,
    dueDate: normalizeDueDate(task.due_date),
    ambiguityNote: task.ambiguity_note,
    aiSuggestion: task.ai_suggestion,
  }))

  await deps.runs.finish({
    runId: run.id,
    model: extracted.data.usage.model,
    taskCount: suggestions.length,
    inputChars: text.length,
    inputTokens: extracted.data.usage.inputTokens,
    outputTokens: extracted.data.usage.outputTokens,
  })

  return ok({
    suggestions,
    summary: extracted.data.document_summary,
    usage: extracted.data.usage,
  })
}
