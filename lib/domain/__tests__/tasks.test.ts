import { describe, expect, it } from 'vitest'
import {
  type TaskPriority,
  type TaskStatus,
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TITLE_MAX_LENGTH,
  groupTasksByStatus,
  isTaskPriority,
  isTaskStatus,
  normalizeDueDate,
  sortTasksForDisplay,
  validateTaskTitle,
} from '@/lib/domain/tasks'

type Sortable = {
  id: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
}

function task(
  id: string,
  priority: TaskPriority,
  dueDate: string | null = null,
  status: TaskStatus = 'todo',
): Sortable {
  return { id, status, priority, dueDate }
}

describe('validateTaskTitle', () => {
  it('前後の空白を取り除いて受け入れる', () => {
    const result = validateTaskTitle('  見積もりを提出する  ')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe('見積もりを提出する')
  })

  it('空文字を拒否する', () => {
    const result = validateTaskTitle('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('上限を超える名前を拒否する', () => {
    expect(validateTaskTitle('あ'.repeat(TASK_TITLE_MAX_LENGTH + 1)).ok).toBe(false)
  })

  it('ちょうど上限は受け入れる', () => {
    expect(validateTaskTitle('あ'.repeat(TASK_TITLE_MAX_LENGTH)).ok).toBe(true)
  })

  it('上限は 200 文字である', () => {
    expect(TASK_TITLE_MAX_LENGTH).toBe(200)
  })
})

describe('normalizeDueDate', () => {
  it('YYYY-MM-DD をそのまま返す', () => {
    expect(normalizeDueDate('2026-09-10')).toBe('2026-09-10')
  })

  it('空文字は null にする', () => {
    expect(normalizeDueDate('')).toBeNull()
    expect(normalizeDueDate('   ')).toBeNull()
  })

  it('自然言語の期限は null にする', () => {
    // AI は「来週まで」「適宜」のような表現を返すことがある
    expect(normalizeDueDate('来週まで')).toBeNull()
    expect(normalizeDueDate('適宜')).toBeNull()
    expect(normalizeDueDate('9月10日')).toBeNull()
  })

  it('形式が正しくても存在しない日付は null にする', () => {
    expect(normalizeDueDate('2026-02-30')).toBeNull()
    expect(normalizeDueDate('2026-13-01')).toBeNull()
  })
})

describe('ステータスと優先度', () => {
  it('ステータスは 3 種類である', () => {
    expect([...TASK_STATUSES]).toEqual(['todo', 'doing', 'done'])
  })

  it('優先度は 3 種類である', () => {
    expect([...TASK_PRIORITIES]).toEqual(['high', 'medium', 'low'])
  })

  it('型ガードが正しく判定する', () => {
    expect(isTaskStatus('todo')).toBe(true)
    expect(isTaskStatus('archived')).toBe(false)
    expect(isTaskPriority('high')).toBe(true)
    expect(isTaskPriority('urgent')).toBe(false)
  })

  it('日本語ラベルがすべて定義されている', () => {
    for (const status of TASK_STATUSES) expect(STATUS_LABEL[status]).toBeTruthy()
    for (const priority of TASK_PRIORITIES) expect(PRIORITY_LABEL[priority]).toBeTruthy()
  })
})

describe('groupTasksByStatus', () => {
  it('3 つのステータスすべてのキーを必ず返す', () => {
    const grouped = groupTasksByStatus([])
    expect(Object.keys(grouped).sort()).toEqual(['doing', 'done', 'todo'])
    expect(grouped.todo).toEqual([])
    expect(grouped.doing).toEqual([])
    expect(grouped.done).toEqual([])
  })

  it('ステータスごとに振り分ける', () => {
    const grouped = groupTasksByStatus([
      task('a', 'high', null, 'todo'),
      task('b', 'low', null, 'doing'),
      task('c', 'medium', null, 'done'),
      task('d', 'high', null, 'todo'),
    ])
    expect(grouped.todo.map((t) => t.id)).toEqual(['a', 'd'])
    expect(grouped.doing.map((t) => t.id)).toEqual(['b'])
    expect(grouped.done.map((t) => t.id)).toEqual(['c'])
  })
})

describe('sortTasksForDisplay', () => {
  it('優先度の高い順に並べる', () => {
    const sorted = sortTasksForDisplay([
      task('low', 'low'),
      task('high', 'high'),
      task('medium', 'medium'),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['high', 'medium', 'low'])
  })

  it('優先度が同じなら期限の早い順に並べる', () => {
    const sorted = sortTasksForDisplay([
      task('later', 'high', '2026-10-01'),
      task('sooner', 'high', '2026-09-01'),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['sooner', 'later'])
  })

  it('期限のないタスクは期限のあるタスクより後に並べる', () => {
    const sorted = sortTasksForDisplay([
      task('none', 'high', null),
      task('dated', 'high', '2026-12-31'),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['dated', 'none'])
  })

  it('元の配列を書き換えない', () => {
    const original = [task('low', 'low'), task('high', 'high')]
    sortTasksForDisplay(original)
    expect(original.map((t) => t.id)).toEqual(['low', 'high'])
  })
})
