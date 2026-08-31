import { type Result, err, ok } from '@/lib/domain/result'
import {
  DEFAULT_WORK_SETTINGS,
  type TaskWeight,
  type WorkSettings,
  isTaskWeight,
  isWithinWorkHours,
  isWorkDay,
} from '@/lib/domain/schedule'
import type { SchedulePlanner } from '@/lib/gemini/plan-schedule-client'
import type { Schedule, ScheduleRepository } from '@/lib/repositories/schedules'
import type { TaskRepository } from '@/lib/repositories/tasks'
import type { WorkSettingsRepository } from '@/lib/repositories/work-settings'

export type ScheduleDraft = {
  /** 画面での識別子。重複検出の相手判定にも使う */
  key: string
  taskId: string
  taskTitle: string
  startsAt: string
  endsAt: string
  reason: string
  weight: TaskWeight
  overlapAcceptable: boolean
  /** 稼働日・稼働時間帯から外れている */
  outOfWorkHours: boolean
}

type Deps = {
  tasks: TaskRepository
  schedules: ScheduleRepository
  workSettings: WorkSettingsRepository
  planner: SchedulePlanner
}

export type PlanScheduleOutput = {
  drafts: ScheduleDraft[]
  confirmed: Schedule[]
  note: string
  settings: WorkSettings
}

/**
 * 未完了タスクからスケジュールの仮案を作る。
 *
 * ここでは保存しない。保存はユーザーが編集・確定したあとに行う。
 * 重複の検出は行わない。ユーザーが日時を編集するたびに変わるため、
 * 画面側で `findOverlaps` を使って毎回計算する。
 */
export async function planScheduleForProject(
  deps: Deps,
  input: { projectId: string; userId: string; today: string },
): Promise<Result<PlanScheduleOutput>> {
  const allTasks = await deps.tasks.listByProject(input.projectId)
  const pending = allTasks.filter((task) => task.status !== 'done')

  if (pending.length === 0) {
    return err('NO_SCHEDULABLE_TASKS', '予定を立てるタスクがありません。')
  }

  const settings =
    (await deps.workSettings.find(input.userId)) ?? DEFAULT_WORK_SETTINGS

  const confirmed = await deps.schedules.listByProject(input.projectId)

  // 不透明点メモと AI 改善提案は日程算出に不要なため送らない
  const planned = await deps.planner.plan({
    today: input.today,
    settings,
    tasks: pending.map((task) => ({
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
    })),
    confirmed: confirmed.map((schedule) => ({
      taskTitle: schedule.taskTitle,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
    })),
  })
  if (!planned.ok) return planned

  const byTitle = new Map(pending.map((task) => [task.title, task]))

  const drafts: ScheduleDraft[] = []
  planned.data.schedules.forEach((proposal, index) => {
    const task = byTitle.get(proposal.task_title)
    if (!task) return

    const start = Date.parse(proposal.starts_at)
    const end = Date.parse(proposal.ends_at)
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return

    const range = { startsAt: proposal.starts_at, endsAt: proposal.ends_at }
    const outOfWorkHours =
      !isWorkDay(proposal.starts_at, settings) || !isWithinWorkHours(range, settings)

    drafts.push({
      key: `${task.id}-${index}`,
      taskId: task.id,
      taskTitle: task.title,
      startsAt: proposal.starts_at,
      endsAt: proposal.ends_at,
      reason: proposal.reason,
      weight: isTaskWeight(proposal.weight) ? proposal.weight : 'normal',
      overlapAcceptable: proposal.overlap_acceptable,
      outOfWorkHours,
    })
  })

  return ok({
    drafts,
    confirmed,
    note: planned.data.overall_note,
    settings,
  })
}
