import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AiUsageNote } from '@/components/ui/ai-usage-note'

describe('AiUsageNote', () => {
  it('トークン量・所要時間・モデルを表示する', () => {
    render(
      <AiUsageNote
        usage={{
          model: 'gemini-3.5-flash',
          inputTokens: 3200,
          outputTokens: 850,
          inputChars: 12_000,
        }}
        durationMs={18_234}
      />,
    )

    const text = screen.getByRole('status').textContent ?? ''
    expect(text).toContain('入力 3,200')
    expect(text).toContain('出力 850')
    expect(text).toContain('18.2秒')
    expect(text).toContain('gemini-3.5-flash')
  })

  it('埋め込みは文字数で表し、トークン数が出ない理由を添える', () => {
    render(
      <AiUsageNote
        usage={{
          model: 'gemini-embedding-2',
          inputTokens: 0,
          outputTokens: 0,
          inputChars: 12_400,
        }}
        durationMs={4_100}
      />,
    )

    const text = screen.getByRole('status').textContent ?? ''
    expect(text).toContain('入力 12,400文字')
    expect(text).toContain('埋め込みはトークン数を返しません')
  })

  it('成功の知らせなので alert ではなく status で伝える', () => {
    render(
      <AiUsageNote
        usage={{ model: 'm', inputTokens: 1, outputTokens: 1, inputChars: 1 }}
        durationMs={1000}
      />,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
