import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/lib/domain/result'
import { callAction } from '@/lib/client/safe-action'

describe('callAction', () => {
  it('成功した結果をそのまま返す', async () => {
    const result = await callAction(async () => ok(42))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe(42)
  })

  it('Server Action が返したエラーをそのまま返す', async () => {
    const result = await callAction(async () => ({
      ok: false as const,
      error: { code: 'NOT_FOUND' as const, message: '見つかりません。' },
    }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('通信の例外を Result のエラーに変換する', async () => {
    const result = await callAction(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NETWORK_ERROR')
      expect(result.error.message).toContain('通信')
    }
  })

  it('例外を外に投げ直さない', async () => {
    await expect(
      callAction(async () => {
        throw new Error('想定外')
      }),
    ).resolves.toBeDefined()
  })

  it('文字列が投げられても壊れない', async () => {
    const result = await callAction(async () => {
      throw 'なにか'
    })
    expect(result.ok).toBe(false)
  })
})
