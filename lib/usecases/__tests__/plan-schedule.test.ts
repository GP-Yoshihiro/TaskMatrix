import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/lib/domain/result'
import { DEFAULT_WORK_SETTINGS } from '@/lib/domain/schedule'
import type { SchedulePlanner } from '@/lib/gemini/plan-schedule-client'
import type { ScheduleRepository } from '@/lib/repositories/schedules'
import type { Task, TaskRepository } from '@/lib/repositories/tasks'
import type { WorkSettingsRepository } from '@/lib/repositories/work-settings'
import { planScheduleForProject } from '@/lib/usecases/plan-schedule'

function makeTask(id: string, title: string, status: Task['status'] = 'todo'): Task {
  return {
    id,
    projectId: 'p1',
    sourceFileId: null,
    sourceVersion: null,
    title,
    description: '',
    status,
    priority: 'high',
    assignee: '',
    dueDate: '2026-09-10',
    ambiguityNote: '不透明点',
    aiSuggestion: '改善案',
    origin: 'ai',
    position: 0,
    updatedAt: '2026-08-31T00:00:00Z',
  }
}

const goodProposal = {
  task_title: '見積もりを提出する',
  starts_at: '2026-09-01T09:00:00+09:00',
  ends_at: '2026-09-01T11:00:00+09:00',
  reason: '期限まで余裕があるうちに着手するため。',
  weight: 'heavy' as const,
  overlap_acceptable: false,
}

function makeDeps(overrides: {
  tasks?: Task[]
  proposals?: (typeof goodProposal)[]
} = {}) {
  const tasks = overrides.tasks ?? [makeTask('t1', '見積もりを提出する')]

  const taskRepo: TaskRepository = {
    listByProject: vi.fn(async () => tasks),
    createMany: vi.fn(async () => 0),
    update: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }

  const scheduleRepo: ScheduleRepository = {
    listByProject: vi.fn(async () => []),
    createMany: vi.fn(async () => 0),
    remove: vi.fn(async () => {}),
  }

  const workSettings: WorkSettingsRepository = {
    find: vi.fn(async () => null),
    save: vi.fn(async () => {}),
  }

  const planner: SchedulePlanner = {
    plan: vi.fn(async () =>
      ok({
        schedules: overrides.proposals ?? [goodProposal],
        overall_note: '優先度順に配置しました。',
        usage: {
          model: 'gemini-3.5-flash',
          inputTokens: 100,
          outputTokens: 200,
          inputChars: 0,
        },
      }),
    ),
  }

  return { tasks: taskRepo, schedules: scheduleRepo, workSettings, planner }
}

const input = { projectId: 'p1', userId: 'u1', today: '2026-08-31' }

describe('planScheduleForProject', () => {
  it('未完了タスクから仮案を作る', async () => {
    const deps = makeDeps()
    const result = await planScheduleForProject(deps, input)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.drafts).toHaveLength(1)
      expect(result.data.drafts[0].taskId).toBe('t1')
      expect(result.data.drafts[0].weight).toBe('heavy')
    }
  })

  it('完了済みタスクを AI に送らない', async () => {
    const deps = makeDeps({
      tasks: [makeTask('t1', 'やること'), makeTask('t2', '終わったこと', 'done')],
    })
    await planScheduleForProject(deps, input)

    const sent = (deps.planner.plan as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(sent.tasks.map((t: { title: string }) => t.title)).toEqual(['やること'])
  })

  it('未完了タスクが 0 件なら AI を呼ばずに拒否する', async () => {
    const deps = makeDeps({ tasks: [makeTask('t1', '終わったこと', 'done')] })
    const result = await planScheduleForProject(deps, input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NO_SCHEDULABLE_TASKS')
    expect(deps.planner.plan).not.toHaveBeenCalled()
  })

  it('不透明点メモと改善提案を送らない', async () => {
    const deps = makeDeps()
    await planScheduleForProject(deps, input)

    const sent = JSON.stringify(
      (deps.planner.plan as ReturnType<typeof vi.fn>).mock.calls[0][0],
    )
    expect(sent).not.toContain('不透明点')
    expect(sent).not.toContain('改善案')
  })

  it('稼働条件が未設定なら既定値を使う', async () => {
    const deps = makeDeps()
    await planScheduleForProject(deps, input)

    const sent = (deps.planner.plan as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(sent.settings).toEqual(DEFAULT_WORK_SETTINGS)
  })

  it('稼働時間外の提案には印を付けるが除外しない', async () => {
    const deps = makeDeps({
      proposals: [
        {
          ...goodProposal,
          starts_at: '2026-09-01T20:00:00+09:00',
          ends_at: '2026-09-01T22:00:00+09:00',
        },
      ],
    })
    const result = await planScheduleForProject(deps, input)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.drafts).toHaveLength(1)
      expect(result.data.drafts[0].outOfWorkHours).toBe(true)
    }
  })

  it('稼働日でない日の提案にも印を付ける', async () => {
    const deps = makeDeps({
      proposals: [
        {
          ...goodProposal,
          starts_at: '2026-09-05T09:00:00+09:00', // 土曜
          ends_at: '2026-09-05T11:00:00+09:00',
        },
      ],
    })
    const result = await planScheduleForProject(deps, input)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.drafts[0].outOfWorkHours).toBe(true)
  })

  it('日時として解釈できない提案は除外する', async () => {
    const deps = makeDeps({
      proposals: [{ ...goodProposal, starts_at: '来週', ends_at: 'そのうち' }],
    })
    const result = await planScheduleForProject(deps, input)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.drafts).toHaveLength(0)
  })

  it('終了が開始以前の提案は除外する', async () => {
    const deps = makeDeps({
      proposals: [
        {
          ...goodProposal,
          starts_at: '2026-09-01T11:00:00+09:00',
          ends_at: '2026-09-01T09:00:00+09:00',
        },
      ],
    })
    const result = await planScheduleForProject(deps, input)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.drafts).toHaveLength(0)
  })

  it('タスク名で照合できない提案は除外する', async () => {
    const deps = makeDeps({
      proposals: [{ ...goodProposal, task_title: '存在しないタスク' }],
    })
    const result = await planScheduleForProject(deps, input)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.drafts).toHaveLength(0)
  })

  it('仮案の段階では保存しない', async () => {
    const deps = makeDeps()
    await planScheduleForProject(deps, input)

    expect(deps.schedules.createMany).not.toHaveBeenCalled()
  })

  it('確定済みスケジュールを AI に送る', async () => {
    const deps = makeDeps()
    deps.schedules.listByProject = vi.fn(async () => [
      {
        id: 's1',
        projectId: 'p1',
        taskId: 't9',
        taskTitle: '定例会議',
        startsAt: '2026-09-01T10:00:00+09:00',
        endsAt: '2026-09-01T11:00:00+09:00',
        reason: '',
        weight: 'normal' as const,
      },
    ])
    await planScheduleForProject(deps, input)

    const sent = (deps.planner.plan as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(sent.confirmed).toHaveLength(1)
    expect(sent.confirmed[0].taskTitle).toBe('定例会議')
  })

  it('確定済みスケジュールも結果に含めて返す', async () => {
    const deps = makeDeps()
    deps.schedules.listByProject = vi.fn(async () => [
      {
        id: 's1',
        projectId: 'p1',
        taskId: 't9',
        taskTitle: '定例会議',
        startsAt: '2026-09-01T10:00:00+09:00',
        endsAt: '2026-09-01T11:00:00+09:00',
        reason: '',
        weight: 'normal' as const,
      },
    ])
    const result = await planScheduleForProject(deps, input)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.confirmed).toHaveLength(1)
  })

  it('各仮案に一意な key が付く', async () => {
    const deps = makeDeps({
      proposals: [goodProposal, { ...goodProposal, starts_at: '2026-09-02T09:00:00+09:00', ends_at: '2026-09-02T11:00:00+09:00' }],
    })
    const result = await planScheduleForProject(deps, input)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const keys = result.data.drafts.map((d) => d.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})
