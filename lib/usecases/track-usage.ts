import { checkDailyLimit, startOfJstDay } from '@/lib/domain/ai-limit'
import { type Result, err, ok } from '@/lib/domain/result'
import { EMPTY_USAGE, type AiOperation, type AiUsage } from '@/lib/domain/usage'
import type { AiUsageRepository, RecordUsageInput } from '@/lib/repositories/ai-usage'

/** 止めたときに利用者へ返す文言。何が上限で、いつ戻るのかを必ず伝える */
function buildLimitMessage(decision: ReturnType<typeof checkDailyLimit>): string {
  const at = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(decision.resetsAt)

  const what =
    decision.reason === 'calls'
      ? `本日の実行回数の上限（${decision.callLimit} 回）`
      : `本日の使用量の上限（${decision.tokenLimit.toLocaleString('ja-JP')} トークン）`

  return `${what}に達しました。${at} を過ぎると、また使えるようになります。`
}

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
 *
 * **実行前に 1 日の上限を確かめる。** ここは AI 呼び出しがすべて通る一点であり、
 * 個々の機能に判定を散らすと、追加した機能で入れ忘れが起きる。
 *
 * 集計に失敗したときは通す。上限は費用の歯止めであって、
 * 数えられないことを理由に機能そのものを止めるのは行き過ぎであるため。
 */
export async function trackUsage<T extends { usage: AiUsage }>(
  repository: AiUsageRepository,
  context: Context,
  run: () => Promise<Result<T>>,
): Promise<Result<T & { durationMs: number }>> {
  const clock = context.now ?? Date.now
  const startedAt = clock()
  const now = new Date(startedAt)

  try {
    const used = await repository.usageSince(startOfJstDay(now).toISOString())
    const decision = checkDailyLimit(used, now)

    if (!decision.allowed) {
      return err('RATE_LIMITED', buildLimitMessage(decision))
    }
  } catch {
    // 数えられなかった場合は通す
  }

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
