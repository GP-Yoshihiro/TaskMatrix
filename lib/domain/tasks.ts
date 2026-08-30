import { type Result, err, ok } from './result'

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'

export const TASK_STATUSES = ['todo', 'doing', 'done'] as const
export const TASK_PRIORITIES = ['high', 'medium', 'low'] as const

/** タスク名の最大文字数 */
export const TASK_TITLE_MAX_LENGTH = 200

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '未着手',
  doing: '進行中',
  done: '完了',
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value)
}

export function isTaskPriority(value: string): value is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value)
}

export function validateTaskTitle(title: string): Result<string> {
  const trimmed = title.trim()

  if (trimmed.length === 0) {
    return err('VALIDATION_ERROR', 'タスク名を入力してください。')
  }

  if (trimmed.length > TASK_TITLE_MAX_LENGTH) {
    return err(
      'VALIDATION_ERROR',
      `タスク名は ${TASK_TITLE_MAX_LENGTH} 文字以内で入力してください。`,
    )
  }

  return ok(trimmed)
}

/**
 * 期限を YYYY-MM-DD に正規化する。
 * AI は「来週まで」「適宜」のような自然言語を返すことがあるため、
 * 確定した日付以外はすべて null にして不透明点として扱わせる。
 */
export function normalizeDueDate(value: string): string | null {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null

  const [year, month, day] = trimmed.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day

  return valid ? trimmed : null
}

/** 優先度の表示順。数値が小さいほど上に出す */
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

type Displayable = {
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
}

/**
 * 表示用に並べ替える。優先度の高い順、同じなら期限の早い順。
 * 期限のないタスクは末尾に置く（期限が決まっているものを先に片付けたいため）。
 * 元の配列は書き換えない。
 */
export function sortTasksForDisplay<T extends Displayable>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (byPriority !== 0) return byPriority

    if (a.dueDate === b.dueDate) return 0
    if (a.dueDate === null) return 1
    if (b.dueDate === null) return -1
    return a.dueDate < b.dueDate ? -1 : 1
  })
}

/** カンバン表示のためにステータスごとに振り分ける。空の列も必ず返す */
export function groupTasksByStatus<T extends Displayable>(
  tasks: T[],
): Record<TaskStatus, T[]> {
  const grouped = { todo: [], doing: [], done: [] } as Record<TaskStatus, T[]>
  for (const task of tasks) {
    grouped[task.status].push(task)
  }
  return grouped
}
