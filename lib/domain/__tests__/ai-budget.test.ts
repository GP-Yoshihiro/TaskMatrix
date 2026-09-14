import { describe, expect, it } from 'vitest'
import {
  AI_TOTAL_BUDGET_MS,
  MIN_ATTEMPT_MS,
  attemptTimeout,
  deadlineFrom,
} from '../ai-budget'

describe('deadlineFrom', () => {
  it('開始時刻に持ち時間を足す', () => {
    expect(deadlineFrom(1_000)).toBe(1_000 + AI_TOTAL_BUDGET_MS)
  })
})

describe('attemptTimeout', () => {
  const deadline = 200_000

  it('残りを、これから試す回数で分ける', () => {
    // 1 回目に全部与えると、遅いモデルに当たったとき
    // 予備を試す時間が残らない
    expect(attemptTimeout(deadline, 100_000, 2)).toBe(50_000)
  })

  it('最後の 1 回には、残りをすべて与える', () => {
    expect(attemptTimeout(deadline, 100_000, 1)).toBe(100_000)
  })

  it('残りが短すぎれば、始めない', () => {
    // 必ず切れる呼び出しを始めると、そのぶん打ち切りが早まる
    expect(attemptTimeout(deadline, deadline - MIN_ATTEMPT_MS + 1, 1)).toBeNull()
  })

  it('分けた結果が短すぎる場合は、最小を割り当てる', () => {
    // 分けすぎて、どれも始められなくなるのを防ぐ
    expect(attemptTimeout(deadline, deadline - 20_000, 4)).toBe(MIN_ATTEMPT_MS)
  })

  it('期限を過ぎていれば始めない', () => {
    expect(attemptTimeout(deadline, deadline + 1, 1)).toBeNull()
  })
})

describe('持ち時間の値', () => {
  it('画面側の上限（120 秒）より短い', () => {
    // 超えると打ち切られ、日本語のエラーを返す前に通信ごと切れる
    expect(AI_TOTAL_BUDGET_MS).toBeLessThan(120_000)
  })

  it('2 回試しても収まる', () => {
    // 1 回目が時間切れでも、2 回目を最小の時間で始められる
    expect(AI_TOTAL_BUDGET_MS).toBeGreaterThan(MIN_ATTEMPT_MS * 2)
  })
})
