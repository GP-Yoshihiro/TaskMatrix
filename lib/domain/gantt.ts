/**
 * ガントチャートの組み立て。
 *
 * 予定 1 件を 1 本の横棒として、時間軸上の位置と幅（割合）に変換する。
 * 描画側は返された割合をそのまま使えばよく、日付の計算を持たない。
 *
 * 位置の基準は**稼働タイムゾーン**とする。実行環境の時刻で計算すると、
 * 利用者が見ている日付と棒の位置がずれる。
 */

/** 表示範囲。両端を含む YYYY-MM-DD */
export type Bounds = {
  start: string
  end: string
}

export type GanttSource = {
  id: string
  label: string
  startsAt: string
  endsAt: string
  draft: boolean
}

export type GanttBar = {
  id: string
  label: string
  draft: boolean
  /** 左端の位置（0〜100） */
  leftPercent: number
  /** 幅（0〜100） */
  widthPercent: number
  /** 棒の長さだけでは正確な時刻が読めないため添える */
  timeLabel: string
}

export type GanttTick = {
  label: string
  percent: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 幅 0 だと画面から消え、予定があること自体が伝わらない */
const MIN_WIDTH_PERCENT = 0.8

/** ある瞬間における、そのタイムゾーンの UTC からのずれ */
function offsetMs(utcMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))

  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)

  const asUtc = Date.UTC(
    pick('year'),
    pick('month') - 1,
    pick('day'),
    pick('hour') % 24,
    pick('minute'),
    pick('second'),
  )

  return asUtc - utcMs
}

/**
 * そのタイムゾーンの「YYYY-MM-DD の 0 時」を、絶対時刻に直す。
 *
 * ずれは瞬間によって変わる（夏時間の切り替え）ため、
 * 一度求めたずれで引き直し、もう一度確かめる。
 */
function startOfDayMs(dateKey: string, timezone: string): number {
  const guess = Date.parse(`${dateKey}T00:00:00Z`)
  const first = guess - offsetMs(guess, timezone)
  return guess - offsetMs(first, timezone)
}

function boundsMs(bounds: Bounds, timezone: string): { from: number; to: number } {
  return {
    from: startOfDayMs(bounds.start, timezone),
    // 終わりの日も含めるため、その翌日の 0 時までとする
    to: startOfDayMs(bounds.end, timezone) + DAY_MS,
  }
}

function formatTime(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms))
}

/** 表示範囲に重なる予定を、位置と幅の割合に変換する */
export function buildGanttBars(
  entries: GanttSource[],
  bounds: Bounds,
  timezone: string,
): GanttBar[] {
  const { from, to } = boundsMs(bounds, timezone)
  const total = to - from
  if (total <= 0) return []

  return entries
    .map((entry) => {
      const rawStart = Date.parse(entry.startsAt)
      const rawEnd = Date.parse(entry.endsAt)
      if (Number.isNaN(rawStart) || Number.isNaN(rawEnd)) return null

      // 逆順に入っていても壊さない
      const startedAt = Math.min(rawStart, rawEnd)
      const endedAt = Math.max(rawStart, rawEnd)

      // 表示範囲に重ならないものは出さない
      if (endedAt <= from || startedAt >= to) return null

      // はみ出したまま描くと、棒が枠の外へ出てしまう
      const clippedStart = Math.max(startedAt, from)
      const clippedEnd = Math.min(endedAt, to)

      const leftPercent = ((clippedStart - from) / total) * 100
      const rawWidth = ((clippedEnd - clippedStart) / total) * 100
      const widthPercent = Math.min(
        100 - leftPercent,
        Math.max(MIN_WIDTH_PERCENT, rawWidth),
      )

      return {
        id: entry.id,
        label: entry.label,
        draft: entry.draft,
        leftPercent,
        widthPercent,
        timeLabel: `${formatTime(startedAt, timezone)}〜${formatTime(endedAt, timezone)}`,
        sortKey: startedAt,
      }
    })
    .filter((bar): bar is GanttBar & { sortKey: number } => bar !== null)
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((bar) => ({
      // 残す項目を並べる。除外する形で書くと、
      // 並べ替え用の値が画面まで流れてしまう
      id: bar.id,
      label: bar.label,
      draft: bar.draft,
      leftPercent: bar.leftPercent,
      widthPercent: bar.widthPercent,
      timeLabel: bar.timeLabel,
    }))
}

/** 目盛り。1 日なら時刻、複数日なら日付 */
export function ganttHourTicks(bounds: Bounds): GanttTick[] {
  const from = Date.parse(`${bounds.start}T00:00:00Z`)
  const to = Date.parse(`${bounds.end}T00:00:00Z`) + DAY_MS
  const days = Math.round((to - from) / DAY_MS)

  if (days <= 1) {
    // 3 時間ごと。細かくすると文字が重なる
    return Array.from({ length: 8 }, (_, index) => ({
      label: `${index * 3}時`,
      percent: (index * 3 * 100) / 24,
    }))
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(from + index * DAY_MS)
    return {
      label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
      percent: (index * 100) / days,
    }
  })
}
