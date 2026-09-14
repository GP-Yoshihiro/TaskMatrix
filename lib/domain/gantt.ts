/**
 * ガントチャートの組み立て。
 *
 * **左の縦軸＝作業工程、上の横軸＝日付。** 棒は横に伸びる。
 * 工程ごとに 1 行とし、その工程がいつからいつまでかを横位置で表す。
 *
 * 担当ごとに色を分ける。誰の受け持ちかを、行を読まずに見分けられるようにするため。
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
  /** 作業工程名。行の見出しになる */
  label: string
  /** 担当。空文字は未設定として扱う */
  assignee: string
  startsAt: string
  endsAt: string
  draft: boolean
}

export type GanttBar = {
  id: string
  draft: boolean
  /** 範囲の左端からの位置（0〜100） */
  leftPercent: number
  /** 幅（0〜100） */
  widthPercent: number
  /** 棒の長さだけでは正確な期間が読めないため添える */
  timeLabel: string
}

export type GanttTaskRow = {
  /** 行の識別子。工程名と担当の組 */
  key: string
  /** 左に出す工程名 */
  label: string
  assignee: string
  bars: GanttBar[]
}

export type GanttTick = {
  label: string
  percent: number
}

/** 担当が入っていないときの表示 */
export const UNASSIGNED_LABEL = '未設定'

const DAY_MS = 24 * 60 * 60 * 1000

/** 幅 0 だと画面から消え、予定があること自体が伝わらない */
const MIN_WIDTH_PERCENT = 0.6

/**
 * 担当の色。明暗どちらの画面でも判別できる濃さに揃えている。
 * 数を超えたら先頭へ戻る。
 */
const ASSIGNEE_PALETTE = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#65a30d',
  '#dc2626',
] as const

/** 未設定は目立たせない。担当が決まっている行を先に目に入れるため */
const UNASSIGNED_COLOR = '#94a3b8'

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

function dayCount(bounds: Bounds): number {
  const from = Date.parse(`${bounds.start}T00:00:00Z`)
  const to = Date.parse(`${bounds.end}T00:00:00Z`)
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0
  return Math.round((to - from) / DAY_MS) + 1
}

function formatSpan(startedAt: number, endedAt: number, timezone: string): string {
  const date = new Intl.DateTimeFormat('ja-JP', {
    timeZone: timezone,
    month: 'numeric',
    day: 'numeric',
  })
  const time = new Intl.DateTimeFormat('ja-JP', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const from = `${date.format(new Date(startedAt))} ${time.format(new Date(startedAt))}`
  const to = `${date.format(new Date(endedAt))} ${time.format(new Date(endedAt))}`

  return `${from}〜${to}`
}

/** 工程ごとの行に、その工程の予定を並べる */
export function buildGanttTaskRows(
  entries: GanttSource[],
  bounds: Bounds,
  timezone: string,
): GanttTaskRow[] {
  const { from, to } = boundsMs(bounds, timezone)
  const total = to - from
  if (total <= 0) return []

  const rows = new Map<string, GanttTaskRow & { firstStart: number }>()

  for (const entry of entries) {
    const rawStart = Date.parse(entry.startsAt)
    const rawEnd = Date.parse(entry.endsAt)
    if (Number.isNaN(rawStart) || Number.isNaN(rawEnd)) continue

    // 逆順に入っていても壊さない
    const startedAt = Math.min(rawStart, rawEnd)
    const endedAt = Math.max(rawStart, rawEnd)

    // 表示範囲に重ならないものは出さない
    if (endedAt <= from || startedAt >= to) continue

    // はみ出したまま描くと、棒が枠の外へ出てしまう
    const clippedStart = Math.max(startedAt, from)
    const clippedEnd = Math.min(endedAt, to)

    const leftPercent = ((clippedStart - from) / total) * 100
    const rawWidth = ((clippedEnd - clippedStart) / total) * 100

    const assignee = entry.assignee.trim() || UNASSIGNED_LABEL
    // 同じ工程でも担当が違えば、色も責任も別なので行を分ける
    const key = `${entry.label} ${assignee}`

    const bar: GanttBar = {
      id: entry.id,
      draft: entry.draft,
      leftPercent,
      widthPercent: Math.min(100 - leftPercent, Math.max(MIN_WIDTH_PERCENT, rawWidth)),
      timeLabel: formatSpan(startedAt, endedAt, timezone),
    }

    const existing = rows.get(key)
    if (existing) {
      existing.bars.push(bar)
      existing.firstStart = Math.min(existing.firstStart, startedAt)
    } else {
      rows.set(key, {
        key,
        label: entry.label,
        assignee,
        bars: [bar],
        firstStart: startedAt,
      })
    }
  }

  return [...rows.values()]
    .sort((a, b) => a.firstStart - b.firstStart)
    .map((row) => ({
      key: row.key,
      label: row.label,
      assignee: row.assignee,
      bars: [...row.bars].sort((a, b) => a.leftPercent - b.leftPercent),
    }))
}

/** 上部の目盛り。複数日なら日付、1 日なら時刻 */
export function ganttTicks(bounds: Bounds): GanttTick[] {
  const days = dayCount(bounds)

  if (days <= 1) {
    // 日付が 1 つしかないと、どの時間帯かが分からない。
    // 3 時間ごと。細かくすると文字が重なる
    return Array.from({ length: 8 }, (_, index) => ({
      label: `${index * 3}時`,
      percent: (index * 3 * 100) / 24,
    }))
  }

  const from = Date.parse(`${bounds.start}T00:00:00Z`)

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(from + index * DAY_MS)
    return {
      label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
      percent: (index * 100) / days,
    }
  })
}

/**
 * 担当に色を割り当てる。
 *
 * 名前の並び順で決めるのではなく、**名前そのものから決める**。
 * 並び順で変わると、範囲を切り替えるたびに色が入れ替わり、見比べられない。
 */
export function assigneeColors(assignees: string[]): Map<string, string> {
  const colors = new Map<string, string>()

  for (const name of assignees) {
    if (colors.has(name)) continue

    if (name === UNASSIGNED_LABEL) {
      colors.set(name, UNASSIGNED_COLOR)
      continue
    }

    // 文字コードから決める。同じ名前なら、いつでも同じ色になる
    let hash = 0
    for (let index = 0; index < name.length; index++) {
      hash = (hash * 31 + name.charCodeAt(index)) % 1_000_003
    }
    colors.set(name, ASSIGNEE_PALETTE[hash % ASSIGNEE_PALETTE.length])
  }

  return colors
}
