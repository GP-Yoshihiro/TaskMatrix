import { type Result, err, ok } from './result'

/** タスクの重さ。重い順に並べる */
export const TASK_WEIGHTS = [
  'very_heavy',
  'heavy',
  'normal',
  'light',
  'very_light',
] as const

export type TaskWeight = (typeof TASK_WEIGHTS)[number]

export const WEIGHT_LABEL: Record<TaskWeight, string> = {
  very_heavy: '非常に重い',
  heavy: '重い',
  normal: '標準',
  light: '軽い',
  very_light: '非常に軽い',
}

/** 重複の可否についての目安。利用者への助言として表示する */
export const WEIGHT_OVERLAP_HINT: Record<TaskWeight, string> = {
  very_heavy: '他の予定と重ねてはいけません。',
  heavy: '他の予定と重ねるべきではありません。',
  normal: 'できれば他の予定と重ねないでください。',
  light: '他の予定と重なっても差し支えないことが多いです。',
  very_light: '他の予定と重なっても支障はありません。',
}

export function isTaskWeight(value: string): value is TaskWeight {
  return (TASK_WEIGHTS as readonly string[]).includes(value)
}

export type TimeRange = { startsAt: string; endsAt: string }

/**
 * 2 つの期間が重なるか。
 * 終了時刻と開始時刻が同一の「隣接」は重複としない。
 */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  const aStart = Date.parse(a.startsAt)
  const aEnd = Date.parse(a.endsAt)
  const bStart = Date.parse(b.startsAt)
  const bEnd = Date.parse(b.endsAt)

  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false

  return aStart < bEnd && bStart < aEnd
}

/** target と重複している相手だけを返す。自分自身は除外する */
export function findOverlaps<T extends TimeRange & { id: string }>(
  target: T,
  others: T[],
): T[] {
  return others.filter((other) => other.id !== target.id && overlaps(target, other))
}

export type WorkSettings = {
  /** 0=日曜 〜 6=土曜 */
  workDays: number[]
  /** HH:MM */
  workStart: string
  /** HH:MM */
  workEnd: string
  dailyCapacityMinutes: number
  timezone: string
}

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  workDays: [1, 2, 3, 4, 5],
  workStart: '09:00',
  workEnd: '18:00',
  dailyCapacityMinutes: 360,
  timezone: 'Asia/Tokyo',
}

const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** その設定のタイムゾーンで見た曜日・時刻・日付を取り出す */
function partsIn(isoDateTime: string, timezone: string) {
  const date = new Date(isoDateTime)
  if (Number.isNaN(date.getTime())) return null

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  )

  return {
    weekday: WEEKDAY_KEYS.indexOf(parts.weekday ?? ''),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    day: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

function toMinutes(hhmm: string): number {
  const [hour, minute] = hhmm.split(':').map(Number)
  return hour * 60 + minute
}

export function isWorkDay(isoDateTime: string, settings: WorkSettings): boolean {
  const parts = partsIn(isoDateTime, settings.timezone)
  if (!parts) return false
  return settings.workDays.includes(parts.weekday)
}

/** 稼働時間帯に収まっているか。日をまたぐ期間は収まっていないものとする */
export function isWithinWorkHours(range: TimeRange, settings: WorkSettings): boolean {
  const start = partsIn(range.startsAt, settings.timezone)
  const end = partsIn(range.endsAt, settings.timezone)
  if (!start || !end) return false
  if (start.day !== end.day) return false

  return (
    start.minutes >= toMinutes(settings.workStart) &&
    end.minutes <= toMinutes(settings.workEnd) &&
    start.minutes < end.minutes
  )
}

export function validateWorkSettings(input: WorkSettings): Result<WorkSettings> {
  const workDays = [...new Set(input.workDays)].sort((a, b) => a - b)

  if (workDays.length === 0) {
    return err('VALIDATION_ERROR', '稼働する曜日を 1 つ以上選んでください。')
  }

  if (workDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    return err('VALIDATION_ERROR', '稼働曜日の指定が正しくありません。')
  }

  if (!/^\d{2}:\d{2}$/.test(input.workStart) || !/^\d{2}:\d{2}$/.test(input.workEnd)) {
    return err('VALIDATION_ERROR', '稼働時間の形式が正しくありません。')
  }

  const startMinutes = toMinutes(input.workStart)
  const endMinutes = toMinutes(input.workEnd)

  if (startMinutes >= endMinutes) {
    return err('VALIDATION_ERROR', '稼働終了は稼働開始より後の時刻にしてください。')
  }

  if (input.dailyCapacityMinutes <= 0) {
    return err('VALIDATION_ERROR', '1 日の上限は 1 分以上にしてください。')
  }

  if (input.dailyCapacityMinutes > endMinutes - startMinutes) {
    return err('VALIDATION_ERROR', '1 日の上限が稼働時間を超えています。')
  }

  return ok({ ...input, workDays })
}
