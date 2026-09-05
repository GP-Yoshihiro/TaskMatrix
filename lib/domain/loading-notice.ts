/**
 * 読み込みが長引いたときの知らせ。
 *
 * 骨組みだけが出たまま黙って待たされると、壊れているのか
 * 待てば終わるのかが分からない。経過に応じて言葉を変える。
 *
 * ただし最初は何も出さない。一瞬で終わる遷移に文字が点滅すると、
 * かえって遅く感じるため。
 */

/** ここを過ぎたら「読み込んでいます」 */
export const SLOW_MS = 3_000

/** ここを過ぎたら回線を疑う */
export const STALLED_MS = 10_000

/** 経過ミリ秒に応じた文言。まだ出す段階でなければ null */
export function loadingNotice(elapsedMs: number): string | null {
  if (elapsedMs >= STALLED_MS) {
    return '通信が不安定なようです。電波の良い場所でお試しいただくか、しばらくしてから開き直してください。'
  }
  if (elapsedMs >= SLOW_MS) {
    return '読み込んでいます…'
  }
  return null
}
