/**
 * AI の呼び出しに使える持ち時間。
 *
 * これまでは 1 回ごとに 90 秒の上限を置いていた。
 * 時間切れのときに予備のモデルを試すため、**合計で最大 180 秒**かかり、
 * 画面側の上限（`maxDuration = 120` 秒）を超えていた。
 *
 * 超えると**処理が打ち切られ、日本語のエラーを返す前に通信ごと切れる。**
 * 利用者には「通信に失敗しました」としか出ず、理由が分からない。
 *
 * そこで**全体の持ち時間**を決め、各回はその残りを分け合う。
 */

/**
 * 1 度の操作に使える合計。
 *
 * 画面側の上限より短くし、**打ち切られる前に日本語のエラーを返せる**ようにする。
 */
export const AI_TOTAL_BUDGET_MS = 100_000

/**
 * 1 回の呼び出しに最低限必要な時間。
 *
 * これを下回るなら始めない。必ず切れる呼び出しを始めても、
 * 打ち切りが早まるだけで意味が無い。
 */
export const MIN_ATTEMPT_MS = 15_000

/** 開始時刻から、いつまでに終えるべきかを決める */
export function deadlineFrom(startedAt: number): number {
  return startedAt + AI_TOTAL_BUDGET_MS
}

/**
 * 次の呼び出しに与える時間。始めるべきでなければ null。
 */
export function attemptTimeout(deadlineAt: number, now: number): number | null {
  const remaining = deadlineAt - now
  if (remaining < MIN_ATTEMPT_MS) return null
  return remaining
}
