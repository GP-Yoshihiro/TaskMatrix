/**
 * カレンダーの表示範囲。
 *
 * 年・月・週・日を同じ考え方で扱えるようにする。
 * 日付は `YYYY-MM-DD` の文字列で受け渡し、内部の計算は UTC で行う。
 * 実行環境のタイムゾーンで計算すると、境目の日がずれる。
 */

export type CalendarRange = 'year' | 'month' | 'week' | 'day'

export const CALENDAR_RANGES: { value: CalendarRange; label: string }[] = [
  { value: 'year', label: '年' },
  { value: 'month', label: '月' },
  { value: 'week', label: '週' },
  { value: 'day', label: '日' },
]

export type DayCell = {
  /** YYYY-MM-DD */
  date: string
  /** 0=日曜 〜 6=土曜 */
  weekday: number
}

export type YearMonth = {
  /** 1〜12 */
  month: number
  days: DayCell[]
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function parse(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** その月の末日 */
function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * 表示位置を動かす。
 *
 * 月と年は、動かした先に同じ日が無いことがある（1/31 の翌月、うるう日の翌年）。
 * そのまま足すと翌月へこぼれるため、末日で止める。
 */
export function shiftAnchor(range: CalendarRange, anchor: string, delta: number): string {
  const date = parse(anchor)

  if (range === 'day') {
    date.setUTCDate(date.getUTCDate() + delta)
    return toKey(date)
  }

  if (range === 'week') {
    date.setUTCDate(date.getUTCDate() + delta * 7)
    return toKey(date)
  }

  const monthsToAdd = range === 'year' ? delta * 12 : delta
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + monthsToAdd

  const targetYear = year + Math.floor(month / 12)
  const targetMonth = ((month % 12) + 12) % 12 + 1
  const day = Math.min(date.getUTCDate(), lastDayOf(targetYear, targetMonth))

  return `${targetYear}-${pad(targetMonth)}-${pad(day)}`
}

/** 表示範囲の始まりと終わり（両端を含む） */
export function rangeBounds(
  range: CalendarRange,
  anchor: string,
): { start: string; end: string } {
  const date = parse(anchor)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1

  if (range === 'day') return { start: anchor, end: anchor }

  if (range === 'week') {
    const start = new Date(date)
    // 日曜を週の始まりとする
    start.setUTCDate(start.getUTCDate() - start.getUTCDay())
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 6)
    return { start: toKey(start), end: toKey(end) }
  }

  if (range === 'month') {
    return {
      start: `${year}-${pad(month)}-01`,
      end: `${year}-${pad(month)}-${pad(lastDayOf(year, month))}`,
    }
  }

  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

/** 見出し。いまどこを見ているかを一目で分かるようにする */
export function rangeLabel(range: CalendarRange, anchor: string): string {
  const date = parse(anchor)
  const year = date.getUTCFullYear()

  if (range === 'year') return `${year}年`
  if (range === 'month') return `${year}年${date.getUTCMonth() + 1}月`

  if (range === 'day') {
    return `${year}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日（${WEEKDAY_LABELS[date.getUTCDay()]}）`
  }

  const { start, end } = rangeBounds('week', anchor)
  const from = parse(start)
  const to = parse(end)

  return `${from.getUTCFullYear()}年${from.getUTCMonth() + 1}月${from.getUTCDate()}日 〜 ${to.getUTCMonth() + 1}月${to.getUTCDate()}日`
}

/** 週の 7 日。日曜始まり */
export function buildWeekDays(anchor: string): DayCell[] {
  const { start } = rangeBounds('week', anchor)
  const from = parse(start)

  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(from)
    date.setUTCDate(date.getUTCDate() + offset)
    return { date: toKey(date), weekday: date.getUTCDay() }
  })
}

/** 1 年ぶんの日を月ごとにまとめる。濃淡表示の土台 */
export function buildYearDays(year: number): YearMonth[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const days = Array.from({ length: lastDayOf(year, month) }, (_, dayIndex) => {
      const date = new Date(Date.UTC(year, index, dayIndex + 1))
      return { date: toKey(date), weekday: date.getUTCDay() }
    })
    return { month, days }
  })
}

/** 濃淡の段階。0（予定なし）〜 4（最も多い） */
export function heatLevel(count: number, max: number): number {
  if (count <= 0) return 0
  if (max <= 0) return 0

  // 1 件でも必ず色を付ける。0 と見分けが付かないと見落とす
  return Math.max(1, Math.ceil((count / max) * 4))
}
