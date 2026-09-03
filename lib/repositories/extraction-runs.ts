import type { SupabaseClient } from '@supabase/supabase-js'

export interface ExtractionRunRepository {
  start(input: {
    projectId: string
    fileId: string
    fileVersion: number
    userId: string
  }): Promise<{ id: string }>
  finish(input: {
    runId: string
    model: string
    taskCount: number
    inputChars: number
    inputTokens: number
    outputTokens: number
  }): Promise<void>
  fail(input: { runId: string; errorMessage: string }): Promise<void>
}

/**
 * AI タスク抽出の実行記録。
 *
 * 行レベルセキュリティにより、自分のデータだけが見える。
 */
export function createSupabaseExtractionRunRepository(
  supabase: SupabaseClient,
): ExtractionRunRepository {
  return {
    async start({ projectId, fileId, fileVersion, userId }) {
      const { data, error } = await supabase
        .from('extraction_runs')
        .insert({
          project_id: projectId,
          file_id: fileId,
          file_version: fileVersion,
          created_by: userId,
          status: 'running',
        })
        .select('id')
        .single()
      if (error) throw error
      return { id: (data as { id: string }).id }
    },

    async finish({ runId, model, taskCount, inputChars, inputTokens, outputTokens }) {
      const { error } = await supabase
        .from('extraction_runs')
        .update({
          status: 'succeeded',
          model,
          task_count: taskCount,
          input_chars: inputChars,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId)
      if (error) throw error
    },

    async fail({ runId, errorMessage }) {
      const { error } = await supabase
        .from('extraction_runs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId)
      if (error) throw error
    },
  }
}
