import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const base = {
  open: true,
  title: '本当に削除しますか？',
  confirmLabel: '削除する',
  onConfirm: () => {},
  onCancel: () => {},
}

describe('ConfirmDialog', () => {
  it('open が false のときは何も描画しない', () => {
    render(<ConfirmDialog {...base} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('見出しと確認ボタンを表示する', () => {
    render(<ConfirmDialog {...base} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('本当に削除しますか？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '削除する' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
  })

  it('注意文言を渡すと表示する', () => {
    render(<ConfirmDialog {...base} warning="一度削除すると復元はできません。" />)
    expect(screen.getByText('一度削除すると復元はできません。')).toBeInTheDocument()
  })

  it('注意文言を渡さなければ表示しない', () => {
    render(<ConfirmDialog {...base} />)
    expect(screen.queryByText(/復元はできません/)).not.toBeInTheDocument()
  })

  it('説明文を表示する', () => {
    render(<ConfirmDialog {...base} description="プロジェクト「設計資料」を削除します。" />)
    expect(screen.getByText('プロジェクト「設計資料」を削除します。')).toBeInTheDocument()
  })

  it('確認ボタンで onConfirm を呼ぶ', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...base} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: '削除する' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('キャンセルで onCancel を呼ぶ', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...base} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape キーで onCancel を呼ぶ', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...base} onCancel={onCancel} />)
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('見出しをダイアログのラベルに紐づける', () => {
    render(<ConfirmDialog {...base} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId!)?.textContent).toBe('本当に削除しますか？')
  })

  it('処理中は両方のボタンを無効にする', () => {
    render(<ConfirmDialog {...base} pending />)
    expect(screen.getByRole('button', { name: '削除する' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled()
  })

  it('処理中は Escape で閉じない', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...base} pending onCancel={onCancel} />)
    await userEvent.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
  })
})
