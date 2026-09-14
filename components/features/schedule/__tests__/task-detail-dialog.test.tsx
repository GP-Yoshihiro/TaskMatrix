import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TaskDetailDialog } from '@/components/features/schedule/task-detail-dialog'
import type { Task } from '@/lib/repositories/tasks'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))

vi.mock('@/lib/actions/tasks', () => ({
  createTaskAction: vi.fn(async () => ({ ok: true, data: null })),
  updateTaskAction: vi.fn(async () => ({ ok: true, data: null })),
  deleteTaskAction: vi.fn(async () => ({ ok: true, data: null })),
  moveTaskAction: vi.fn(async () => ({ ok: true, data: null })),
}))

const TASK: Task = {
  id: 't1',
  projectId: 'p1',
  sourceFileId: null,
  sourceVersion: null,
  title: '基礎工事',
  description: '型枠を組む',
  status: 'todo',
  priority: 'high',
  assignee: '',
  assigneeMemberId: 'm1',
  assigneeMemberName: '田中',
  estimatedDays: 2.5,
  estimateSource: 'inferred',
  dueDate: '2026-09-30',
  ambiguityNote: '',
  aiSuggestion: '',
  origin: 'ai',
  position: 0,
  updatedAt: '2026-09-14T00:00:00.000Z',
}

function setup(task: Task | null = TASK) {
  const onClose = vi.fn()
  const onSaved = vi.fn()

  render(
    <TaskDetailDialog
      task={task}
      projectId="p1"
      members={[{ id: 'm1', name: '田中' }]}
      onClose={onClose}
      onSaved={onSaved}
    />,
  )

  return { user: userEvent.setup(), onClose, onSaved }
}

describe('TaskDetailDialog', () => {
  it('タスクが無ければ何も出さない', () => {
    const { container } = render(
      <TaskDetailDialog
        task={null}
        projectId="p1"
        members={[]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('詳細を先に出す', () => {
    // いきなり入力欄が並ぶと、見るだけのときに読みにくい
    setup()

    expect(screen.getByText('基礎工事')).toBeInTheDocument()
    expect(screen.getByText('型枠を組む')).toBeInTheDocument()
    expect(screen.queryByLabelText(/想定日程/)).not.toBeInTheDocument()
  })

  it('担当・想定日程・期限を示す', () => {
    setup()

    expect(screen.getByText('田中')).toBeInTheDocument()
    expect(screen.getByText(/2.5 日/)).toBeInTheDocument()
    expect(screen.getByText('2026-09-30')).toBeInTheDocument()
  })

  it('想定日程が推定であることを添える', () => {
    // 推定値を、書かれていた数値と同じ顔で出さない
    setup()
    expect(screen.getByText(/AI が作業内容から推定した日数です/)).toBeInTheDocument()
  })

  it('編集するを押すと、入力欄が出る', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: '編集する' }))

    expect(screen.getByLabelText(/想定日程/)).toBeInTheDocument()
  })

  it('編集をやめると、詳細に戻る', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: '編集する' }))
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(screen.queryByLabelText(/想定日程/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '編集する' })).toBeInTheDocument()
  })

  it('閉じるを押すと、閉じることを求める', async () => {
    const { user, onClose } = setup()

    await user.click(screen.getByRole('button', { name: '閉じる' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Escape でも閉じる', async () => {
    const { user, onClose } = setup()

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })
})
