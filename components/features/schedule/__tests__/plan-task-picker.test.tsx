import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlanTaskPicker } from '@/components/features/schedule/plan-task-picker'
import { MAX_PLAN_TASKS } from '@/lib/domain/plan-selection'
import type { Task } from '@/lib/repositories/tasks'

function task(id: string, title: string, dueDate: string | null): Task {
  return {
    id,
    projectId: 'p1',
    sourceFileId: null,
    sourceVersion: null,
    title,
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee: '',
    assigneeMemberId: null,
    assigneeMemberName: null,
    estimatedDays: null,
    estimateSource: '',
    dueDate,
    ambiguityNote: '',
    aiSuggestion: '',
    origin: 'manual',
    position: 0,
    updatedAt: '2026-09-14T00:00:00.000Z',
  }
}

const TASKS = [
  task('t1', '後の作業', '2026-12-01'),
  task('t2', '急ぎの作業', '2026-09-20'),
  task('t3', '期限なしの作業', null),
]

function setup(selected: string[] = []) {
  const onChange = vi.fn()

  render(
    <PlanTaskPicker
      tasks={TASKS}
      selected={new Set(selected)}
      onChange={onChange}
      disabled={false}
    />,
  )

  return { user: userEvent.setup(), onChange }
}

describe('PlanTaskPicker', () => {
  it('件数と上限を示す', () => {
    setup()

    expect(screen.getByText(/3 件/)).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(String(MAX_PLAN_TASKS))).length).toBeGreaterThan(0)
  })

  it('多すぎると中断する理由を伝える', () => {
    // なぜ選ばされるのかが分からないと、操作が不可解に見える
    setup()
    expect(screen.getByText(/応答が返らず、中断します/)).toBeInTheDocument()
  })

  it('タスクを並べる', () => {
    setup()

    expect(screen.getByText('急ぎの作業')).toBeInTheDocument()
    expect(screen.getByText('期限なしの作業')).toBeInTheDocument()
  })

  it('選んだ件数を示す', () => {
    setup(['t1', 't2'])
    expect(screen.getByText(/2 \/ 100 件/)).toBeInTheDocument()
  })

  it('押すと選択の入れ替えを求める', async () => {
    const { user, onChange } = setup()

    await user.click(screen.getByRole('checkbox', { name: /急ぎの作業/ }))

    expect(onChange).toHaveBeenCalledOnce()
    expect([...(onChange.mock.calls[0][0] as Set<string>)]).toEqual(['t2'])
  })

  it('期限の近い順に選べる', async () => {
    // よく使う選び方を 1 押しで済ませる
    const { user, onChange } = setup()

    await user.click(screen.getByRole('button', { name: /期限の近い順/ }))

    const picked = [...(onChange.mock.calls[0][0] as Set<string>)]
    // 期限の早い順。期限なしは後ろ
    expect(picked).toEqual(['t2', 't1', 't3'])
  })

  it('選択を解除できる', async () => {
    const { user, onChange } = setup(['t1'])

    await user.click(screen.getByRole('button', { name: '選択を解除' }))

    expect([...(onChange.mock.calls[0][0] as Set<string>)]).toEqual([])
  })

  it('選んでいなければ、解除は押せない', () => {
    setup()
    expect(screen.getByRole('button', { name: '選択を解除' })).toBeDisabled()
  })
})
