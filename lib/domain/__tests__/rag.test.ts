import { describe, expect, it } from 'vitest'
import { EXCERPT_LENGTH, MAX_HISTORY_TURNS, buildAnswerPrompt, buildExcerpt, trimHistory } from '@/lib/domain/rag'

describe('buildExcerpt', () => {
  it('短い本文はそのまま返す', () => {
    expect(buildExcerpt('短い本文')).toBe('短い本文')
  })

  it('長い本文は切り詰めて … を付ける', () => {
    const result = buildExcerpt('あ'.repeat(500))
    expect(result.length).toBeLessThanOrEqual(EXCERPT_LENGTH + 1)
    expect(result.endsWith('…')).toBe(true)
  })

  it('改行を空白に置き換えて 1 行にする', () => {
    expect(buildExcerpt('一行目\n二行目')).toBe('一行目 二行目')
  })

  it('連続する空白をまとめる', () => {
    expect(buildExcerpt('a   b')).toBe('a b')
  })

  it('前後の空白を取り除く', () => {
    expect(buildExcerpt('  本文  ')).toBe('本文')
  })

  it('日本語が壊れない', () => {
    const result = buildExcerpt('設計レビューを実施する。'.repeat(50))
    expect(result).not.toContain('�')
    expect(result.startsWith('設計レビュー')).toBe(true)
  })
})

describe('trimHistory', () => {
  const messages = Array.from({ length: 30 }, (_, index) => ({ id: `m${index}` }))

  it('直近のやり取りだけを残す', () => {
    const result = trimHistory(messages)
    expect(result).toHaveLength(MAX_HISTORY_TURNS * 2)
    expect(result[result.length - 1].id).toBe('m29')
  })

  it('少ないときはそのまま返す', () => {
    const few = messages.slice(0, 3)
    expect(trimHistory(few)).toHaveLength(3)
  })

  it('空配列でも壊れない', () => {
    expect(trimHistory([])).toEqual([])
  })

  it('元の配列を書き換えない', () => {
    const original = [...messages]
    trimHistory(messages)
    expect(messages).toEqual(original)
  })
})

describe('buildAnswerPrompt', () => {
  const input = {
    question: '見積もりの期限は？',
    excerpts: [
      { fileName: '要件メモ.md', content: '見積もりは来週までに提出する。' },
      { fileName: '議事録.docx', content: 'レビューは9月10日。' },
    ],
    history: [
      { role: 'user' as const, content: '前の質問' },
      { role: 'assistant' as const, content: '前の回答' },
    ],
  }

  it('質問文を含む', () => {
    expect(buildAnswerPrompt(input)).toContain('見積もりの期限は？')
  })

  it('抜粋にファイル名を添える', () => {
    const prompt = buildAnswerPrompt(input)
    expect(prompt).toContain('要件メモ.md')
    expect(prompt).toContain('見積もりは来週までに提出する。')
  })

  it('直近の会話を含む', () => {
    expect(buildAnswerPrompt(input)).toContain('前の回答')
  })

  it('資料に無いことは分からないと答えるよう指示する', () => {
    expect(buildAnswerPrompt(input)).toContain('資料からは分かりません')
  })

  it('推測で答えないよう指示する', () => {
    expect(buildAnswerPrompt(input)).toContain('推測')
  })

  it('日本語で答えるよう指示する', () => {
    expect(buildAnswerPrompt(input)).toContain('日本語')
  })

  it('会話履歴が無くても壊れない', () => {
    expect(() => buildAnswerPrompt({ ...input, history: [] })).not.toThrow()
    expect(buildAnswerPrompt({ ...input, history: [] })).toContain('なし')
  })

  it('抜粋が無くても壊れない', () => {
    expect(() => buildAnswerPrompt({ ...input, excerpts: [] })).not.toThrow()
  })
})
