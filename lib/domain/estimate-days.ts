/**
 * タスクの想定日程（何日かかるか）。
 *
 * 0.5 日刻みで持つ。半日で終わる作業を 1 日と数えずに済み、
 * 時間単位ほど入力の負担が増えない。
 *
 * 値の出どころは 2 つある。
 *
 * - **資料に書かれていた数値**（`document`）
 * - **作業内容からの推定**（`inferred`）
 *
 * 両者は必ず見分けられるようにする。推定値を書かれていた数値と
 * 同じ顔で出すと、根拠のない数字を信じてしまう。
 */

/** 刻み。半日単位 */
export const ESTIMATE_STEP = 0.5

/** 上限。極端な値で日程表が壊れるのを防ぐ */
export const MAX_ESTIMATED_DAYS = 365

/** 1 日とみなす稼働時間。時間の表記を日数へ直すときに使う */
const HOURS_PER_DAY = 8

/** 1 週とみなす稼働日数 */
const DAYS_PER_WEEK = 5

/** 想定日程の出どころ */
export type EstimateSource = 'document' | 'inferred'

/** 出どころの説明。推定値を鵜呑みにさせないために添える */
export const ESTIMATE_SOURCE_LABEL: Record<EstimateSource | '', string> = {
  document: '資料に書かれていた日数です',
  inferred: 'AI が作業内容から推定した日数です',
  '': '手で入力された日数です',
}

/**
 * 0.5 日刻みに丸め、範囲に収める。
 *
 * 0 以下は未設定として扱う。0 日で終わる作業は無く、
 * 入っていれば誤りとみなしてよい。
 */
export function normalizeEstimatedDays(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  if (value <= 0) return null

  const rounded = Math.round(value / ESTIMATE_STEP) * ESTIMATE_STEP

  // 丸めた結果が 0 になる（極端に小さい値）ときは最小の刻みにする
  if (rounded < ESTIMATE_STEP) return ESTIMATE_STEP

  return Math.min(rounded, MAX_ESTIMATED_DAYS)
}

/** 入力欄の文字から読み取る */
export function parseEstimatedDays(input: string): number | null {
  const text = input.trim()
  if (text === '') return null

  const value = Number(text)
  if (!Number.isFinite(value)) return null

  return normalizeEstimatedDays(value)
}

/** 画面に出す形 */
export function formatEstimatedDays(days: number | null): string {
  if (days === null) return '未設定'

  // 整数に小数点を付けると、桁を読み違えやすい
  const text = Number.isInteger(days) ? String(days) : days.toFixed(1)
  return `${text} 日`
}

/**
 * 説明文に書かれた所要期間を読み取る。
 *
 * **ここで勝手に決めない。** 数値が見当たらなければ null を返し、
 * 推定は AI に任せる。規則で当てずっぽうを出すと、
 * 資料に書かれていた値との区別が付かなくなる。
 */
export function inferDaysFromDescription(text: string): number | null {
  if (text.trim() === '') return null

  // 「9月14日」のような日付は期限であって、所要日数ではない
  const withoutDates = text.replace(/\d+\s*月\s*\d+\s*日/g, '')

  const days = withoutDates.match(/(\d+(?:\.\d+)?)\s*日/)
  if (days) return normalizeEstimatedDays(Number(days[1]))

  const weeks = withoutDates.match(/(\d+(?:\.\d+)?)\s*週/)
  if (weeks) return normalizeEstimatedDays(Number(weeks[1]) * DAYS_PER_WEEK)

  const hours = withoutDates.match(/(\d+(?:\.\d+)?)\s*時間/)
  if (hours) return normalizeEstimatedDays(Number(hours[1]) / HOURS_PER_DAY)

  return null
}
