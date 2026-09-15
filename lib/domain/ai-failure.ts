/**
 * AI の呼び出しが失敗したとき、何が起きたのかを見分ける。
 *
 * これまでは時間切れ以外をすべて「AI が混雑しています」と伝えていた。
 * **利用上限に達した場合もそう表示され、待てば直るように読めてしまう。**
 *
 * 2026-09-15 に実際に上限へ達し、「1+1は？」すら通らない状態になった。
 * それでも画面には「混雑しています」としか出ず、原因が分からなかった。
 *
 * 上限は待っても直らない（1 日単位で回復する、あるいは課金が要る）。
 * **待つべきなのか、上限なのかを、利用者が区別できるようにする。**
 */

import type { AppError, AppErrorCode } from './result'

/** 上限に達したときの案内先 */
export const AI_QUOTA_HELP_URL =
  'https://aistudio.google.com/app/projects?project=gen-lang-client-0561831696'

export const AI_FAILURE_MESSAGE = {
  quota:
    'AI の利用上限に達しました。時間をおくか、管理者に上限の引き上げをご依頼ください。',
  timeout:
    'スケジュールの算出に時間がかかりすぎたため、中断しました。対象を減らしてお試しください。',
  busy: 'AI が混雑しています。時間をおいてお試しください。',
} as const

function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status
  return typeof status === 'number' ? status : null
}

function textOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : ''
}

/**
 * 利用上限（トークン・リクエスト数）に達したか。
 *
 * 状態番号が取れない経路もあるため、本文も見る。
 */
export function isQuotaError(error: unknown): boolean {
  if (statusOf(error) === 429) return true

  const text = textOf(error).toLowerCase()
  return text.includes('quota') || text.includes('resource_exhausted')
}

/**
 * 次のモデルを試す価値があるか。
 *
 * 時間切れ・混雑・一時的な障害なら試す。
 * 送り方が悪い場合（4xx）は、モデルを変えても同じなので試さない。
 */
export function isRetryableAiError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'TimeoutError') return true
  if (isQuotaError(error)) return true

  const status = statusOf(error)
  return status !== null && status >= 500
}

/**
 * 何が起きたのかを、利用者に伝わる形にする。
 *
 * **上限は時間切れより優先する。**
 * 上限に当たっているなら、対象を減らしても直らない。
 * 「対象を減らして」と促すのは、かえって遠回りをさせる。
 */
export function describeAiFailure({
  ranOutOfTime,
  hitQuota,
  timeoutMessage = AI_FAILURE_MESSAGE.timeout,
}: {
  ranOutOfTime: boolean
  hitQuota: boolean
  /** 時間切れのときの文言。機能ごとに「何を減らせばよいか」が違う */
  timeoutMessage?: string
}): AppError {
  if (hitQuota) {
    return { code: 'RATE_LIMITED' as AppErrorCode, message: AI_FAILURE_MESSAGE.quota }
  }

  if (ranOutOfTime) {
    return { code: 'AI_TIMEOUT' as AppErrorCode, message: timeoutMessage }
  }

  return { code: 'AI_MODEL_UNAVAILABLE' as AppErrorCode, message: AI_FAILURE_MESSAGE.busy }
}
