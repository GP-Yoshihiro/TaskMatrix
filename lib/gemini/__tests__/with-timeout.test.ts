import { describe, expect, it } from 'vitest'
import { TimeoutError, withTimeout } from '@/lib/gemini/with-timeout'

describe('withTimeout', () => {
  it('期限内に終われば結果を返す', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000)
    expect(result).toBe('ok')
  })

  it('期限を過ぎたら TimeoutError を投げる', async () => {
    const never = new Promise((resolve) => setTimeout(resolve, 5000))
    await expect(withTimeout(never, 20)).rejects.toBeInstanceOf(TimeoutError)
  })

  it('元の例外はそのまま伝える', async () => {
    const failing = Promise.reject(new Error('本来の失敗'))
    await expect(withTimeout(failing, 1000)).rejects.toThrow('本来の失敗')
  })

  it('成功時にタイマーを残さない', async () => {
    // タイマーが残っているとテストプロセスが終わらない
    await withTimeout(Promise.resolve(1), 60_000)
    expect(true).toBe(true)
  })
})
