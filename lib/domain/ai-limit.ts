/**
 * AI の利用上限。
 *
 * API のキーはサーバー側の 1 本を全員で共有しており、
 * 誰が使っても請求先は運用者ひとりである。上限が無いと、
 * 悪意が無くても暴走や連打で費用が伸びる。
 *
 * 回数とトークン量の**両方**で見る。回数は利用者に伝わりやすく、
 * トークン量は費用に直結する。回数が少なくても巨大な資料を投げれば
 * 費用は伸びるため、片方だけでは歯止めにならない。
 *
 * なお、ここで止められるのは**このアプリを通る呼び出しだけ**である。
 * 請求そのものの歯止めは、Google Cloud 側の予算上限で別に用意すること。
 */

/** 1 人 1 日あたりの実行回数 */
export const DAILY_CALL_LIMIT = 50

/** 1 人 1 日あたりのトークン量（入力＋出力） */
export const DAILY_TOKEN_LIMIT = 300_000

/** 日本標準時の UTC からの差 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 日本時間で「その日の 0 時」を返す。
 *
 * UTC で区切ると、日本の朝 9 時に上限が戻ることになり、
 * 利用者の感覚と合わない。
 */
export function startOfJstDay(now: Date): Date {
  const shifted = now.getTime() + JST_OFFSET_MS
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - JST_OFFSET_MS)
}

/** その日にすでに使った量 */
export type DailyUsage = {
  calls: number
  tokens: number
}

export type LimitDecision = {
  allowed: boolean
  /** 止めた理由。通したときは null */
  reason: 'calls' | 'tokens' | null
  remainingCalls: number
  remainingTokens: number
  callLimit: number
  tokenLimit: number
  /** 次に使えるようになる時刻 */
  resetsAt: Date
}

/** その日の使用量から、次の 1 回を通してよいかを決める */
export function checkDailyLimit(used: DailyUsage, now: Date): LimitDecision {
  const resetsAt = new Date(startOfJstDay(now).getTime() + DAY_MS)

  // 上限を越えた記録が入っていても、負の数を画面に出さない
  const remainingCalls = Math.max(0, DAILY_CALL_LIMIT - used.calls)
  const remainingTokens = Math.max(0, DAILY_TOKEN_LIMIT - used.tokens)

  const reason =
    used.calls >= DAILY_CALL_LIMIT
      ? ('calls' as const)
      : used.tokens >= DAILY_TOKEN_LIMIT
        ? ('tokens' as const)
        : null

  return {
    allowed: reason === null,
    reason,
    remainingCalls,
    remainingTokens,
    callLimit: DAILY_CALL_LIMIT,
    tokenLimit: DAILY_TOKEN_LIMIT,
    resetsAt,
  }
}
