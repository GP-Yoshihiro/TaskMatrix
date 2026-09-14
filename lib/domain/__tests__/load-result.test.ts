import { describe, expect, it } from 'vitest'
import { attempt, firstFailure } from '../load-result'

describe('attempt', () => {
  it('成功すれば値を返す', async () => {
    const result = await attempt(async () => 42)
    expect(result).toEqual({ ok: true, data: 42 })
  })

  it('失敗しても例外を投げず、代わりの値を返す', async () => {
    // 取得の失敗で画面ごと落とさない。読めない箇所だけを知らせる
    const result = await attempt(async () => {
      throw new Error('列がありません')
    }, [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fallback).toEqual([])
  })

  it('同期的に投げられた例外も捕まえる', async () => {
    const result = await attempt(() => {
      throw new Error('即座の失敗')
    }, null)
    expect(result.ok).toBe(false)
  })

  it('null や 0 を返しても成功として扱う', async () => {
    // 値の中身で成否を判断すると、正当な空の結果を失敗にしてしまう
    expect((await attempt(async () => null)).ok).toBe(true)
    expect((await attempt(async () => 0)).ok).toBe(true)
  })
})

describe('firstFailure', () => {
  it('すべて成功なら null', () => {
    expect(firstFailure([{ ok: true, data: 1 }, { ok: true, data: 2 }])).toBeNull()
  })

  it('失敗があれば、その旨を返す', () => {
    const failure = { ok: false as const, fallback: [], error: 'タスク' }
    expect(firstFailure([{ ok: true, data: 1 }, failure])).toBe('タスク')
  })

  it('最初の失敗だけを返す', () => {
    // 複数並べても、利用者に伝えるべきことは「読めなかった」の一言
    const a = { ok: false as const, fallback: null, error: '先' }
    const b = { ok: false as const, fallback: null, error: '後' }
    expect(firstFailure([a, b])).toBe('先')
  })
})
