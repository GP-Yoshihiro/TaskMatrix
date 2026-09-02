/**
 * TaskMatrix の予定と Google の予定の対応付け。
 *
 * 取り込むのは日時の変更だけとする。
 * TaskMatrix の予定は必ずタスクに紐づくため、Google 側の削除や新規作成を
 * 持ち込むと「タスクはあるのに予定だけ消えた」状態を作ってしまう。
 */

export type GoogleEventInput = {
  summary: string
  description: string
  start: { dateTime: string }
  end: { dateTime: string }
}

export type RemoteEvent = {
  status: string
  start: string | null
  end: string | null
}

export type ScheduleTimes = {
  startsAt: string
  endsAt: string
}

export function toGoogleEvent(input: {
  taskTitle: string
  reason: string
  startsAt: string
  endsAt: string
}): GoogleEventInput {
  return {
    summary: input.taskTitle,
    // 算出理由を添えると、カレンダー側だけ見てもなぜこの時間なのか分かる
    description: input.reason ? `TaskMatrix の算出理由: ${input.reason}` : 'TaskMatrix',
    start: { dateTime: input.startsAt },
    end: { dateTime: input.endsAt },
  }
}

/** 同じ時刻かどうか。表記のゆれ（+09:00 と Z）で誤判定しないよう数値で比べる */
function sameInstant(a: string, b: string): boolean {
  const left = Date.parse(a)
  const right = Date.parse(b)

  return !Number.isNaN(left) && !Number.isNaN(right) && left === right
}

const NO_CHANGE = (local: ScheduleTimes) => ({
  changed: false as const,
  startsAt: local.startsAt,
  endsAt: local.endsAt,
})

/**
 * Google 側の予定を見て、取り込むべき日時の変更があるかを判定する。
 *
 * 壊れた値で上書きしないよう、取り込めない形はすべて「変更なし」として扱う。
 */
export function diffSchedule(
  local: ScheduleTimes,
  remote: RemoteEvent,
): { changed: boolean; startsAt: string; endsAt: string } {
  // 削除は取り込まない
  if (remote.status === 'cancelled') return NO_CHANGE(local)

  // 終日予定に変えられた場合など、日時が取れないものは触らない
  if (!remote.start || !remote.end) return NO_CHANGE(local)

  const start = Date.parse(remote.start)
  const end = Date.parse(remote.end)
  if (Number.isNaN(start) || Number.isNaN(end)) return NO_CHANGE(local)

  // schedules には ends_at > starts_at の制約がある
  if (end <= start) return NO_CHANGE(local)

  const changed =
    !sameInstant(local.startsAt, remote.start) || !sameInstant(local.endsAt, remote.end)

  if (!changed) return NO_CHANGE(local)

  return { changed: true, startsAt: remote.start, endsAt: remote.end }
}
