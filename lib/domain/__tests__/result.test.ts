import { describe, expect, it } from 'vitest'
import { err, ok } from '@/lib/domain/result'

describe('Result', () => {
  it('ok は成功の値を保持する', () => {
    const result = ok(42)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe(42)
  })

  it('err はコードと日本語メッセージを保持する', () => {
    const result = err('NOT_FOUND', '対象が見つかりません。')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
      expect(result.error.message).toBe('対象が見つかりません。')
    }
  })
})
