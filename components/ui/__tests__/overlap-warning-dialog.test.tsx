import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OverlapWarningDialog } from '@/components/app/overlap-warning-dialog'

const pairs = [
  {
    draftKey: 'k1',
    draftLabel: '見積もりを提出する',
    withLabel: '定例会議',
    kind: 'confirmed' as const,
  },
  {
    draftKey: 'k2',
    draftLabel: 'レビューを実施する',
    withLabel: '見積もりを提出する',
    kind: 'draft' as const,
  },
]

const base = {
  open: true,
  pairs,
  pending: false,
  onConfirm: () => {},
  onCancel: () => {},
}

describe('OverlapWarningDialog', () => {
  it('open が false のときは描画しない', () => {
    render(<OverlapWarningDialog {...base} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('重複している組み合わせをすべて表示する', () => {
    render(<OverlapWarningDialog {...base} />)
    const text = screen.getByRole('dialog').textContent ?? ''
    expect(text).toContain('見積もりを提出する')
    expect(text).toContain('定例会議')
    expect(text).toContain('レビューを実施する')
  })

  it('重複件数を見出しに出す', () => {
    render(<OverlapWarningDialog {...base} />)
    expect(screen.getByRole('dialog').textContent).toContain('2')
  })

  it('確定済みとの重複と仮案どうしの重複を区別して示す', () => {
    render(<OverlapWarningDialog {...base} />)
    const text = screen.getByRole('dialog').textContent ?? ''
    expect(text).toContain('確定済み')
    expect(text).toContain('仮案')
  })

  it('削除ではないため復元不可の文言は出さない', () => {
    render(<OverlapWarningDialog {...base} />)
    expect(screen.queryByText(/復元はできません/)).not.toBeInTheDocument()
  })

  it('承知して確定すると onConfirm を呼ぶ', async () => {
    const onConfirm = vi.fn()
    render(<OverlapWarningDialog {...base} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: '重複を承知で確定する' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('取り消すと onCancel を呼ぶ', async () => {
    const onCancel = vi.fn()
    render(<OverlapWarningDialog {...base} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: '戻って修正する' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape で onCancel を呼ぶ', async () => {
    const onCancel = vi.fn()
    render(<OverlapWarningDialog {...base} onCancel={onCancel} />)
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('処理中は両方のボタンを無効にする', () => {
    render(<OverlapWarningDialog {...base} pending />)
    expect(screen.getByRole('button', { name: '重複を承知で確定する' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '戻って修正する' })).toBeDisabled()
  })

  it('見出しをダイアログのラベルに紐づける', () => {
    render(<OverlapWarningDialog {...base} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId!)?.textContent).toContain('重複')
  })
})
