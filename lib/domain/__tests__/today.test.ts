import { describe, expect, it } from 'vitest'
import type { Schedule } from '@/lib/repositories/schedules'
import type { Task } from '@/lib/repositories/tasks'
import { selectTodayTasks } from '../today'

const TODAY = '2026-09-01'

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    projectId: 'p1',
    sourceFileId: null,
    sourceVersion: null,
    title: `タスク${overrides.id}`,
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee: '',
    dueDate: null,
    ambiguityNote: '',
    aiSuggestion: '',
    origin: 'manual',
    position: 0,
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

function schedule(taskId: string, startsAt: string, endsAt: string): Schedule {
  return {
    id: `s-${taskId}`,
    projectId: 'p1',
    taskId,
    taskTitle: `タスク${taskId}`,
    startsAt,
    endsAt,
    reason: '',
    weight: 'normal',
  }
}

describe('selectTodayTasks', () => {
  it('期限が今日のタスクを含む', () => {
    const result = selectTodayTasks({
      tasks: [task({ id: 'a', dueDate: TODAY })],
      schedules: [],
      today: TODAY,
    })

    expect(result.map((item) => item.id)).toEqual(['a'])
  })

  it('期限を過ぎたタスクも含む', () => {
    // 過ぎたものこそ今日やるべきなので、落としてはいけない
    const result = selectTodayTasks({
      tasks: [task({ id: 'a', dueDate: '2026-08-20' })],
      schedules: [],
      today: TODAY,
    })

    expect(result.map((item) => item.id)).toEqual(['a'])
  })

  it('期限が先でも今日の予定があれば含む', () => {
    const result = selectTodayTasks({
      tasks: [task({ id: 'a', dueDate: '2026-12-31' })],
      schedules: [schedule('a', `${TODAY}T09:00:00+09:00`, `${TODAY}T10:00:00+09:00`)],
      today: TODAY,
    })

    expect(result.map((item) => item.id)).toEqual(['a'])
  })

  it('期限も予定も無いタスクは含めない', () => {
    const result = selectTodayTasks({
      tasks: [task({ id: 'a' })],
      schedules: [],
      today: TODAY,
    })

    expect(result).toEqual([])
  })

  it('明日が期限のタスクは含めない', () => {
    const result = selectTodayTasks({
      tasks: [task({ id: 'a', dueDate: '2026-09-02' })],
      schedules: [],
      today: TODAY,
    })

    expect(result).toEqual([])
  })

  it('明日の予定は含めない', () => {
    const result = selectTodayTasks({
      tasks: [task({ id: 'a' })],
      schedules: [schedule('a', '2026-09-02T09:00:00+09:00', '2026-09-02T10:00:00+09:00')],
      today: TODAY,
    })

    expect(result).toEqual([])
  })

  it('完了したタスクは含めない', () => {
    const result = selectTodayTasks({
      tasks: [task({ id: 'a', dueDate: TODAY, status: 'done' })],
      schedules: [schedule('a', `${TODAY}T09:00:00+09:00`, `${TODAY}T10:00:00+09:00`)],
      today: TODAY,
    })

    expect(result).toEqual([])
  })

  it('期限も予定も今日でも 1 回しか出さない', () => {
    const result = selectTodayTasks({
      tasks: [task({ id: 'a', dueDate: TODAY })],
      schedules: [schedule('a', `${TODAY}T09:00:00+09:00`, `${TODAY}T10:00:00+09:00`)],
      today: TODAY,
    })

    expect(result).toHaveLength(1)
  })

  it('予定があるものを先に、開始時刻の早い順で出す', () => {
    const result = selectTodayTasks({
      tasks: [
        task({ id: 'a', dueDate: TODAY }),
        task({ id: 'b' }),
        task({ id: 'c' }),
      ],
      schedules: [
        schedule('c', `${TODAY}T14:00:00+09:00`, `${TODAY}T15:00:00+09:00`),
        schedule('b', `${TODAY}T09:00:00+09:00`, `${TODAY}T10:00:00+09:00`),
      ],
      today: TODAY,
    })

    expect(result.map((item) => item.id)).toEqual(['b', 'c', 'a'])
  })

  it('予定が無いものは期限の近い順に出す', () => {
    const result = selectTodayTasks({
      tasks: [
        task({ id: 'a', dueDate: TODAY }),
        task({ id: 'b', dueDate: '2026-08-10' }),
      ],
      schedules: [],
      today: TODAY,
    })

    expect(result.map((item) => item.id)).toEqual(['b', 'a'])
  })

  it('期限が同じなら優先度の高い順に出す', () => {
    const result = selectTodayTasks({
      tasks: [
        task({ id: 'a', dueDate: TODAY, priority: 'low' }),
        task({ id: 'b', dueDate: TODAY, priority: 'high' }),
        task({ id: 'c', dueDate: TODAY, priority: 'medium' }),
      ],
      schedules: [],
      today: TODAY,
    })

    expect(result.map((item) => item.id)).toEqual(['b', 'c', 'a'])
  })

  it('予定の開始・終了を添えて返す', () => {
    const result = selectTodayTasks({
      tasks: [task({ id: 'a' })],
      schedules: [schedule('a', `${TODAY}T09:00:00+09:00`, `${TODAY}T10:00:00+09:00`)],
      today: TODAY,
    })

    expect(result[0].startsAt).toBe(`${TODAY}T09:00:00+09:00`)
    expect(result[0].endsAt).toBe(`${TODAY}T10:00:00+09:00`)
  })

  it('予定が無いものは開始・終了を null にする', () => {
    const result = selectTodayTasks({
      tasks: [task({ id: 'a', dueDate: TODAY })],
      schedules: [],
      today: TODAY,
    })

    expect(result[0].startsAt).toBeNull()
    expect(result[0].endsAt).toBeNull()
  })

  it('消えたタスクを指す予定は無視する', () => {
    const result = selectTodayTasks({
      tasks: [],
      schedules: [schedule('missing', `${TODAY}T09:00:00+09:00`, `${TODAY}T10:00:00+09:00`)],
      today: TODAY,
    })

    expect(result).toEqual([])
  })
})
