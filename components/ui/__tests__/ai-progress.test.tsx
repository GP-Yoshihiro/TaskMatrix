import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiProgress } from '@/components/ui/ai-progress'
import { PROGRESS_CAP } from '@/lib/domain/usage'

const base = { pending: true, estimateMs: 20_000, isMeasured: true }

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function barWidth() {
  return screen.getByTestId('ai-progress-bar').style.width
}

describe('AiProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('処理中でなければ何も描画しない', () => {
    render(<AiProgress {...base} pending={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('経過時間と予測時間を表示する', () => {
    render(<AiProgress {...base} />)
    advance(5_000)

    expect(screen.getByRole('status').textContent).toContain('5.0秒経過')
    expect(screen.getByRole('status').textContent).toContain('予測 約20秒')
  })

  it('時間の経過とともに表示が更新される', () => {
    render(<AiProgress {...base} />)
    advance(3_000)
    expect(screen.getByRole('status').textContent).toContain('3.0秒経過')

    advance(4_000)
    expect(screen.getByRole('status').textContent).toContain('7.0秒経過')
  })

  it('実績がない予測は「目安」と示す', () => {
    render(<AiProgress {...base} isMeasured={false} />)
    advance(1_000)

    expect(screen.getByRole('status').textContent).toContain('目安')
  })

  it('実績にもとづく予測には「目安」を付けない', () => {
    render(<AiProgress {...base} />)
    advance(1_000)

    expect(screen.getByRole('status').textContent).not.toContain('目安')
  })

  it('完了前にバーを 100% にしない', () => {
    // 「終わったのに固まっている」という誤解を防ぐ
    render(<AiProgress {...base} />)
    advance(19_900)

    expect(barWidth()).toBe(`${PROGRESS_CAP * 100}%`)
  })

  it('予測を超えたら経過時間だけを示す', () => {
    render(<AiProgress {...base} />)
    advance(25_000)

    const text = screen.getByRole('status').textContent ?? ''
    expect(text).toContain('予測を超えています')
    expect(text).toContain('25.0秒経過')
    expect(text).not.toContain('処理中…')
  })

  it('処理が終わったらタイマーを止める', () => {
    const clearInterval = vi.spyOn(globalThis, 'clearInterval')
    const view = render(<AiProgress {...base} />)
    advance(2_000)

    view.rerender(<AiProgress {...base} pending={false} />)

    expect(clearInterval).toHaveBeenCalled()
    clearInterval.mockRestore()
  })

  it('再開したら経過時間が 0 に戻る', () => {
    const view = render(<AiProgress {...base} />)
    advance(8_000)

    view.rerender(<AiProgress {...base} pending={false} />)
    view.rerender(<AiProgress {...base} pending />)
    advance(1_000)

    expect(screen.getByRole('status').textContent).toContain('1.0秒経過')
  })
})
