import { type Result, ok } from '@/lib/domain/result'
import { EMPTY_USAGE, type AiOperation, type AiUsage } from '@/lib/domain/usage'
import type { AiUsageRepository, RecordUsageInput } from '@/lib/repositories/ai-usage'

type Context = {
  userId: string
  projectId: string | null
  operation: AiOperation
  /** テストから時計を差し替えるための口 */
  now?: () => number
}

/**
 * AI 処理を包み、使用量と所要時間を記録する。
 *
 * 測るのは利用者が待つ時間そのもの（前処理・埋め込み・AI 呼び出しを含む全体）。
 * 記録に失敗しても AI の結果はそのまま返す。記録は付随的な機能であり、
 * これが原因で本来の処理が失敗するのは本末転倒であるため。
 */
export async function trackUsage<T extends { usage: AiUsage }>(
  repository: AiUsageRepository,
  context: Context,
  run: () => Promise<Result<T>>,
): Promise<Result<T & { durationMs: number }>> {
  const clock = context.now ?? Date.now
  const startedAt = clock()

  const save = async (
    input: Omit<RecordUsageInput, 'userId' | 'projectId' | 'operation'>,
  ) => {
    try {
      await repository.record({
        userId: context.userId,
        projectId: context.projectId,
        operation: context.operation,
        ...input,
      })
    } catch {
      // 記録できなくても処理は続ける
    }
  }

  let result: Result<T>
  try {
    result = await run()
  } catch (error) {
    // 想定外の例外も使用量としては失敗。記録してから呼び出し元へ渡す
    await save({
      usage: EMPTY_USAGE,
      durationMs: clock() - startedAt,
      status: 'failed',
      errorCode: 'UNKNOWN',
    })
    throw error
  }

  const durationMs = clock() - startedAt

  // 失敗時は応答が無くトークン数が分からない。推定せず 0 のままにする
  await save({
    usage: result.ok ? result.data.usage : EMPTY_USAGE,
    durationMs,
    status: result.ok ? 'succeeded' : 'failed',
    errorCode: result.ok ? '' : result.error.code,
  })

  if (!result.ok) return result

  return ok({ ...result.data, durationMs })
}
