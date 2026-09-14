/**
 * ガントチャートの組み立て。
 *
 * **日付の軸を縦にとる。** 1 日 = 1 行とし、行の中の横位置がその日の時刻を表す。
 * 横軸に日付を並べると、1 件あたりの棒が細くなり、
 * 「その日の何時から何時か」が読み取れなくなる。
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
  /** その日の 0 時からの位置（0〜100） */
  leftPercent: number
  /** 幅（0〜100） */
  widthPercent: number
  /** 棒の長さだけでは正確な時刻が読めないため添える */
  timeLabel: string
  /** 重なりを避けるための段。0 が最上段 */
  lane: number
}

export type GanttDayRow = {
  /** YYYY-MM-DD */
  date: string
  /** 左に出す見出し。例: 9/14（月） */
  label: string
  /** この行に必要な段数。予定が無くても 1 */
  lanes: number
  bars: GanttBar[]
}

export type GanttTick = {
  label: string
  percent: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 幅 0 だと画面から消え、予定があること自体が伝わらない */
const MIN_WIDTH_PERCENT = 1.2

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

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

function formatTime(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms))
}

/** 範囲に含まれる日付を並べる */
function datesIn(bounds: Bounds): string[] {
  const from = Date.parse(`${bounds.start}T00:00:00Z`)
  const to = Date.parse(`${bounds.end}T00:00:00Z`)
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return []

  const days = Math.round((to - from) / DAY_MS) + 1

  return Array.from({ length: days }, (_, index) => {
    return new Date(from + index * DAY_MS).toISOString().slice(0, 10)
  })
}

function dayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`)
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}（${WEEKDAY_LABELS[date.getUTCDay()]}）`
}

/**
 * 重なる予定に段を割り当てる。
 *
 * 同じ段に置くと、あとの棒が前の棒を覆って見えなくなる。
 * 空いている一番上の段へ順に入れる。
 */
function assignLanes(
  items: { startedAt: number; endedAt: number }[],
): { lanes: number; laneOf: number[] } {
  const laneEnds: number[] = []
  const laneOf: number[] = []

  for (const item of items) {
    let lane = laneEnds.findIndex((endedAt) => endedAt <= item.startedAt)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(item.endedAt)
    } else {
      laneEnds[lane] = item.endedAt
    }
    laneOf.push(lane)
  }

  return { lanes: Math.max(1, laneEnds.length), laneOf }
}

/** 日付ごとの行に、その日の予定を並べる */
export function buildGanttDayRows(
  entries: GanttSource[],
  bounds: Bounds,
  timezone: string,
): GanttDayRow[] {
  return datesIn(bounds).map((date) => {
    const from = startOfDayMs(date, timezone)
    const to = from + DAY_MS
    const total = to - from

    const inDay = entries
      .map((entry) => {
        const rawStart = Date.parse(entry.startsAt)
        const rawEnd = Date.parse(entry.endsAt)
        if (Number.isNaN(rawStart) || Number.isNaN(rawEnd)) return null

        // 逆順に入っていても壊さない
        const startedAt = Math.min(rawStart, rawEnd)
        const endedAt = Math.max(rawStart, rawEnd)

        // この日に重ならないものは出さない
        if (endedAt <= from || startedAt >= to) return null

        return { entry, startedAt, endedAt }
      })
      .filter((item): item is { entry: GanttSource; startedAt: number; endedAt: number } => {
        return item !== null
      })
      .sort((a, b) => a.startedAt - b.startedAt)

    // 日をまたぐ予定は、この日の範囲で切る。
    // 切らずに描くと、棒が行の外へはみ出す
    const clipped = inDay.map((item) => ({
      startedAt: Math.max(item.startedAt, from),
      endedAt: Math.min(item.endedAt, to),
    }))

    const { lanes, laneOf } = assignLanes(clipped)

    const bars = inDay.map((item, index) => {
      const leftPercent = ((clipped[index].startedAt - from) / total) * 100
      const rawWidth = ((clipped[index].endedAt - clipped[index].startedAt) / total) * 100

      return {
        id: item.entry.id,
        label: item.entry.label,
        draft: item.entry.draft,
        leftPercent,
        widthPercent: Math.min(100 - leftPercent, Math.max(MIN_WIDTH_PERCENT, rawWidth)),
        timeLabel: `${formatTime(item.startedAt, timezone)}〜${formatTime(item.endedAt, timezone)}`,
        lane: laneOf[index],
      }
    })

    return { date, label: dayLabel(date), lanes, bars }
  })
}

/** 横軸の目盛り。行の中は必ず 0 時〜24 時 */
export function ganttHourTicks(): GanttTick[] {
  // 3 時間ごと。細かくすると文字が重なる
  return Array.from({ length: 8 }, (_, index) => ({
    label: `${index * 3}時`,
    percent: (index * 3 * 100) / 24,
  }))
}
