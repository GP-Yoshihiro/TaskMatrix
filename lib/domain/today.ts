import type { TaskPriority } from '@/lib/domain/tasks'
import type { Schedule } from '@/lib/repositories/schedules'
import type { Task } from '@/lib/repositories/tasks'

export type TodayTask = {
  id: string
  title: string
  priority: TaskPriority
  dueDate: string | null
  startsAt: string | null
  endsAt: string | null
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 優先度の並び順。数値が小さいほど先に出す */
const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }

/** 日本時間での日付（YYYY-MM-DD）。サーバーの時刻が UTC でも日本時間で区切る */
function jstDate(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''

  return new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * 「今日やること」を選ぶ。未完了のうち、次のいずれかを満たすもの。
 *
 * 1. 期限が今日以前（超過分を含む。過ぎたものこそ今日やるべきなので落とさない）
 * 2. 今日の確定済み予定がある（期限が先でも、今日に割り当てたなら今日やること）
 *
 * 期限だけで絞ると 2 が漏れ、予定だけで絞ると 1 が漏れるため、和集合とする。
 */
export function selectTodayTasks(input: {
  tasks: Task[]
  schedules: Schedule[]
  today: string
}): TodayTask[] {
  // 今日の予定だけを引く。1 つのタスクに複数あれば最も早いものを代表とする
  const todaySchedules = new Map<string, Schedule>()

  for (const schedule of input.schedules) {
    if (jstDate(schedule.startsAt) !== input.today) continue

    const current = todaySchedules.get(schedule.taskId)
    if (!current || schedule.startsAt < current.startsAt) {
      todaySchedules.set(schedule.taskId, schedule)
    }
  }

  const selected = input.tasks
    .filter((task) => task.status !== 'done')
    .filter(
      (task) =>
        (task.dueDate !== null && task.dueDate <= input.today) ||
        todaySchedules.has(task.id),
    )
    .map((task) => {
      const schedule = todaySchedules.get(task.id)

      return {
        id: task.id,
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate,
        startsAt: schedule?.startsAt ?? null,
        endsAt: schedule?.endsAt ?? null,
      }
    })

  return selected.sort(compare)
}

/** 予定があるものを開始時刻順に先へ。続けて期限の近い順、同じなら優先度の高い順 */
function compare(a: TodayTask, b: TodayTask): number {
  if (a.startsAt && b.startsAt) return a.startsAt < b.startsAt ? -1 : 1
  if (a.startsAt) return -1
  if (b.startsAt) return 1

  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1
    if (b.dueDate === null) return -1
    return a.dueDate < b.dueDate ? -1 : 1
  }

  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
}
