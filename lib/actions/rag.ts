'use server'

import { revalidatePath } from 'next/cache'
import { type Result, err, ok } from '@/lib/domain/result'
import type { WithUsage } from '@/lib/domain/usage'
import { createOfficeParserExtractor } from '@/lib/extraction/text'
import { createGeminiQuestionAnswerer } from '@/lib/gemini/answer-question'
import { createGeminiEmbedder } from '@/lib/gemini/embeddings'
import { createSupabaseAiUsageRepository } from '@/lib/repositories/ai-usage'
import { createSupabaseChatRepository, type ChatSource } from '@/lib/repositories/chat'
import { createSupabaseFileChunkRepository } from '@/lib/repositories/file-chunks'
import { createSupabaseFileVersionRepository } from '@/lib/repositories/file-versions'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { answerQuestion } from '@/lib/usecases/answer-question'
import { buildIndexForProject } from '@/lib/usecases/build-index'
import { trackUsage } from '@/lib/usecases/track-usage'

const BUCKET = 'project-files'

export async function buildIndexAction(
  formData: FormData,
): Promise<Result<WithUsage<{ files: number; chunks: number }>>> {
  const projectId = String(formData.get('projectId') ?? '')
  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    const result = await trackUsage(
      createSupabaseAiUsageRepository(supabase),
      { userId: user.id, projectId, operation: 'build_index' },
      () =>
        buildIndexForProject(
          {
            files: createSupabaseFileRepository(supabase),
            versions: createSupabaseFileVersionRepository(supabase),
            chunks: createSupabaseFileChunkRepository(supabase),
            embedder: createGeminiEmbedder(),
            textExtractor: createOfficeParserExtractor(),
            downloadBinary: async (storagePath) => {
              const { data, error } = await supabase.storage
                .from(BUCKET)
                .download(storagePath)
              if (error || !data) throw error ?? new Error('download failed')
              return new Uint8Array(await data.arrayBuffer())
            },
          },
          { projectId },
        ),
    )

    if (result.ok) revalidatePath(`/projects/${projectId}/chat`)
    return result
  } catch {
    return err('UNKNOWN', '検索用データを作成できませんでした。')
  }
}

export async function askAction(
  formData: FormData,
): Promise<Result<WithUsage<{ answer: string; sources: ChatSource[] }>>> {
  const projectId = String(formData.get('projectId') ?? '')
  const question = String(formData.get('question') ?? '')

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    const result = await trackUsage(
      createSupabaseAiUsageRepository(supabase),
      { userId: user.id, projectId, operation: 'answer_question' },
      () =>
        answerQuestion(
          {
            chunks: createSupabaseFileChunkRepository(supabase),
            files: createSupabaseFileRepository(supabase),
            chat: createSupabaseChatRepository(supabase),
            embedder: createGeminiEmbedder(),
            answerer: createGeminiQuestionAnswerer(),
          },
          { projectId, userId: user.id, question },
        ),
    )

    if (result.ok) revalidatePath(`/projects/${projectId}/chat`)
    return result
  } catch {
    return err('UNKNOWN', '回答を作成できませんでした。')
  }
}
