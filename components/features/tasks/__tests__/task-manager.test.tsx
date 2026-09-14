import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TaskManager } from '@/components/features/tasks/task-manager'
import type { Task } from '@/lib/repositories/tasks'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))

const deleteTasks = vi.fn()

vi.mock('@/lib/actions/tasks', () => ({
  createTaskAction: vi.fn(async () => ({ ok: true, data: null })),
  updateTaskAction: vi.fn(async () => ({ ok: true, data: null })),
  deleteTaskAction: vi.fn(async () => ({ ok: true, data: null })),
  deleteTasksAction: (...args: unknown[]) => deleteTasks(...args),
  moveTaskAction: vi.fn(async () => ({ ok: true, data: null })),
}))

function task(id: string, title: string, position: number): Task {
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
    dueDate: null,
    ambiguityNote: '',
    aiSuggestion: '',
    origin: 'manual',
    position,
    updatedAt: '2026-09-14T00:00:00.000Z',
  }
}

const TASKS = [task('t1', '最初のタスク', 0), task('t2', '二番目のタスク', 1)]

function setup() {
  return {
    user: userEvent.setup(),
    ...render(<TaskManager projectId="p1" tasks={TASKS} members={[]} />),
  }
}

/** 編集枠かどうかは、その中の「想定日程」欄で見分ける */
function isEditForm(node: HTMLElement): boolean {
  return within(node).queryByLabelText(/想定日程/) !== null
}

describe('TaskManager の編集枠の位置', () => {
  it('はじめは編集枠を出さない', () => {
    setup()
    expect(screen.queryByLabelText(/想定日程/)).not.toBeInTheDocument()
  })

  it('編集を押すと、押した行の中に編集枠が出る', async () => {
    const { user } = setup()

    const rows = screen.getAllByRole('listitem')
    await user.click(within(rows[1]).getByRole('button', { name: '編集' }))

    // 押した行の中に出ること。一覧の先頭ではない
    expect(isEditForm(rows[1])).toBe(true)
  })

  it('押していない行には編集枠を出さない', async () => {
    const { user } = setup()

    const rows = screen.getAllByRole('listitem')
    await user.click(within(rows[1]).getByRole('button', { name: '編集' }))

    expect(isEditForm(rows[0])).toBe(false)
  })

  it('一覧の先頭に編集枠を出さない', async () => {
    const { user } = setup()

    const rows = screen.getAllByRole('listitem')
    await user.click(within(rows[1]).getByRole('button', { name: '編集' }))

    // 先頭の行は、二番目を編集していても素のままであること
    expect(within(rows[0]).getByText('最初のタスク')).toBeInTheDocument()
    expect(within(rows[0]).queryByLabelText(/想定日程/)).not.toBeInTheDocument()
  })

  it('別の行の編集を押すと、そちらへ移る', async () => {
    const { user } = setup()

    const rows = screen.getAllByRole('listitem')
    await user.click(within(rows[1]).getByRole('button', { name: '編集' }))
    await user.click(within(rows[0]).getByRole('button', { name: '編集' }))

    // 2 つ同時に開いたままにしない
    expect(isEditForm(rows[0])).toBe(true)
    expect(isEditForm(rows[1])).toBe(false)
  })

  it('キャンセルを押すと閉じる', async () => {
    const { user } = setup()

    const rows = screen.getAllByRole('listitem')
    await user.click(within(rows[1]).getByRole('button', { name: '編集' }))
    await user.click(within(rows[1]).getByRole('button', { name: 'キャンセル' }))

    expect(screen.queryByLabelText(/想定日程/)).not.toBeInTheDocument()
  })
})

describe('TaskManager の複数選択', () => {
  it('はじめは何も選んでいない', () => {
    setup()
    expect(screen.getByText('まだ選んでいません。')).toBeInTheDocument()
  })

  it('選ぶ前は、まとめて削除を押せない', () => {
    // 押しても必ず失敗する操作を誘わない
    setup()
    expect(screen.getByRole('button', { name: '選択したタスクを削除' })).toBeDisabled()
  })

  it('選ぶと件数を示す', async () => {
    const { user } = setup()

    await user.click(screen.getByLabelText('タスク「最初のタスク」を選択'))

    expect(screen.getByText('1 件を選択中')).toBeInTheDocument()
  })

  it('すべて選択で、表示中のすべてを選ぶ', async () => {
    const { user } = setup()

    await user.click(screen.getByLabelText('表示中のタスクをすべて選択'))

    expect(screen.getByText('2 件を選択中')).toBeInTheDocument()
  })

  it('もう一度押すと、すべて外れる', async () => {
    const { user } = setup()

    await user.click(screen.getByLabelText('表示中のタスクをすべて選択'))
    await user.click(screen.getByLabelText('表示中のタスクをすべて選択'))

    expect(screen.getByText('まだ選んでいません。')).toBeInTheDocument()
  })

  it('削除の前に確認を出す', async () => {
    deleteTasks.mockResolvedValue({ ok: true, data: 2 })
    const { user } = setup()

    await user.click(screen.getByLabelText('表示中のタスクをすべて選択'))
    await user.click(screen.getByRole('button', { name: '選択したタスクを削除' }))

    // 取り消せない操作を、確認なしに実行しない
    expect(screen.getByText('選択したタスクを削除しますか？')).toBeInTheDocument()
    expect(screen.getByText(/表示中の 2 件を削除します/)).toBeInTheDocument()
  })

  it('確認を通すと、選んだ分だけ削除を求める', async () => {
    deleteTasks.mockResolvedValue({ ok: true, data: 1 })
    const { user } = setup()

    await user.click(screen.getByLabelText('タスク「二番目のタスク」を選択'))
    await user.click(screen.getByRole('button', { name: '選択したタスクを削除' }))
    await user.click(screen.getByRole('button', { name: 'まとめて削除する' }))

    expect(deleteTasks).toHaveBeenCalledOnce()
    const formData = deleteTasks.mock.calls[0][0] as FormData
    expect(JSON.parse(String(formData.get('ids')))).toEqual(['t2'])
  })
})
