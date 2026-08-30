import { describe, expect, it } from 'vitest'
import { diffLines } from '@/lib/domain/diff'

describe('diffLines', () => {
  it('同一のテキストはすべて unchanged になる', () => {
    const result = diffLines('a\nb', 'a\nb')
    expect(result.every((line) => line.type === 'unchanged')).toBe(true)
    expect(result.map((line) => line.value)).toEqual(['a', 'b'])
  })

  it('追加された行を added として返す', () => {
    const result = diffLines('a', 'a\nb')
    expect(result).toContainEqual({ type: 'added', value: 'b' })
  })

  it('削除された行を removed として返す', () => {
    const result = diffLines('a\nb', 'a')
    expect(result).toContainEqual({ type: 'removed', value: 'b' })
  })

  it('変更行を removed と added の組で返す', () => {
    const result = diffLines('こんにちは', 'こんばんは')
    expect(result).toContainEqual({ type: 'removed', value: 'こんにちは' })
    expect(result).toContainEqual({ type: 'added', value: 'こんばんは' })
  })

  it('空文字同士は空配列を返す', () => {
    expect(diffLines('', '')).toEqual([])
  })

  it('空から本文への変更をすべて added として返す', () => {
    const result = diffLines('', 'a\nb')
    expect(result).toEqual([
      { type: 'added', value: 'a' },
      { type: 'added', value: 'b' },
    ])
  })
})
