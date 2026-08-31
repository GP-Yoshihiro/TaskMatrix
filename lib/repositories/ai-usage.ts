import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiOperation, AiUsage } from '@/lib/domain/usage'

export type AiUsageStatus = 'succeeded' | 'failed'

export type AiUsageLog = {
  id: string
  operation: AiOperation
  model: string
  inputTokens: number
  outputTokens: number
  inputChars: number
  durationMs: number
  status: AiUsageStatus
  errorCode: string
  createdAt: string
}

export type RecordUsageInput = {
  userId: string
  projectId: string | null
  operation: AiOperation
  usage: AiUsage
  durationMs: number
  status: AiUsageStatus
  errorCode: string
}

/**
 * 1 か月の集計で読む行数の上限。
 * これを超えた分は集計に含まれないため、画面側で「一部のみ」と示す。
 */
export const MONTHLY_ROW_CAP = 5000

export interface AiUsageRepository {
  record(input: RecordUsageInput): Promise<void>
  /** 予測時間の材料。成功した実績のみを新しい順で返す */
  recentDurations(operation: AiOperation, limit: number): Promise<number[]>
  listSince(fromIso: string): Promise<{ logs: AiUsageLog[]; truncated: boolean }>
  listRecent(limit: number): Promise<AiUsageLog[]>
}

type Row = {
  id: string
  operation: AiOperation
  model: string
  input_tokens: number
  output_tokens: number
  input_chars: number
  duration_ms: number
  status: AiUsageStatus
  error_code: string
  created_at: string
}

const COLUMNS =
  'id, operation, model, input_tokens, output_tokens, input_chars, duration_ms, status, error_code, created_at'

function toLog(row: Row): AiUsageLog {
  return {
    id: row.id,
    operation: row.operation,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    inputChars: row.input_chars,
    durationMs: row.duration_ms,
    status: row.status,
    errorCode: row.error_code,
    createdAt: row.created_at,
  }
}

/** 行レベルセキュリティで自分の行に限定されるため、読み取りで user_id は指定しない */
export function createSupabaseAiUsageRepository(
  supabase: SupabaseClient,
): AiUsageRepository {
  return {
    async record(input) {
      const { error } = await supabase.from('ai_usage_logs').insert({
        user_id: input.userId,
        project_id: input.projectId,
        operation: input.operation,
        model: input.usage.model,
        input_tokens: input.usage.inputTokens,
        output_tokens: input.usage.outputTokens,
        input_chars: input.usage.inputChars,
        duration_ms: input.durationMs,
        status: input.status,
        error_code: input.errorCode,
      })
      if (error) throw error
    },

    async recentDurations(operation, limit) {
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('duration_ms')
        .eq('operation', operation)
        .eq('status', 'succeeded')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error

      return ((data ?? []) as { duration_ms: number }[]).map((row) => row.duration_ms)
    },

    async listSince(fromIso) {
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select(COLUMNS)
        .gte('created_at', fromIso)
        .order('created_at', { ascending: false })
        .limit(MONTHLY_ROW_CAP)
      if (error) throw error

      const rows = (data ?? []) as Row[]
      return { logs: rows.map(toLog), truncated: rows.length === MONTHLY_ROW_CAP }
    },

    async listRecent(limit) {
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select(COLUMNS)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error

      return ((data ?? []) as Row[]).map(toLog)
    },
  }
}
