import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OverwriteConfirmDialog } from '@/components/features/schedule/overwrite-confirm-dialog'
import type { DuplicateTask } from '@/lib/domain/schedule-overwrite'

const DUPLICATES: DuplicateTask[] = [
  { taskId: 't1', taskTitle: '基礎工事', existingCount: 2, hasGoogleEvent: true },
  { taskId: 't2', taskTitle: '内装', existingCount: 1, hasGoogleEvent: false },
]

function setup(duplicates = DUPLICATES) {
  const onOverwrite = vi.fn()
  const onKeepBoth = vi.fn()
  const onCancel = vi.fn()

  render(
    <OverwriteConfirmDialog
      open
      duplicates={duplicates}
      onOverwrite={onOverwrite}
      onKeepBoth={onKeepBoth}
      onCancel={onCancel}
    />,
  )

  return { user: userEvent.setup(), onOverwrite, onKeepBoth, onCancel }
}

describe('OverwriteConfirmDialog', () => {
  it('重複しているタスクを並べる', () => {
    setup()

    expect(screen.getByText(/基礎工事（既存 2 件）/)).toBeInTheDocument()
    expect(screen.getByText(/内装（既存 1 件）/)).toBeInTheDocument()
  })

  it('置き換わる件数の合計を示す', () => {
    // 何件が消えるのかを、押す前に伝える
    setup()
    expect(screen.getByText(/3 件/)).toBeInTheDocument()
  })

  it('カレンダーに送済みのものがあれば、消えることを伝える', () => {
    setup()

    expect(
      screen.getByText(/Google カレンダー側の予定も削除されます/),
    ).toBeInTheDocument()
  })

  it('送済みが無ければ、カレンダーの注意は出さない', () => {
    // 関係の無い警告を出すと、本当に必要なときに読み飛ばされる
    setup([DUPLICATES[1]])

    expect(screen.queryByText(/Google カレンダー側の予定も削除されます/)).not.toBeInTheDocument()
  })

  it('3 つの選択肢を出す', () => {
    setup()

    for (const label of ['やめる', '両方残す', '置き換える']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('初期の焦点は「両方残す」に置く', () => {
    // 置き換えは取り消せない。既定の操作を安全な側にする
    setup()
    expect(screen.getByRole('button', { name: '両方残す' })).toHaveFocus()
  })

  it('置き換えるを押すと、置き換えを求める', async () => {
    const { user, onOverwrite } = setup()

    await user.click(screen.getByRole('button', { name: '置き換える' }))

    expect(onOverwrite).toHaveBeenCalledOnce()
  })

  it('両方残すを押すと、追加を求める', async () => {
    const { user, onKeepBoth } = setup()

    await user.click(screen.getByRole('button', { name: '両方残す' }))

    expect(onKeepBoth).toHaveBeenCalledOnce()
  })

  it('重複が無ければ、何も出さない', () => {
    const { container } = render(
      <OverwriteConfirmDialog
        open
        duplicates={[]}
        onOverwrite={vi.fn()}
        onKeepBoth={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
