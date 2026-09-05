import { describe, expect, it } from 'vitest'
import {
  DAILY_CALL_LIMIT,
  DAILY_TOKEN_LIMIT,
  checkDailyLimit,
  startOfJstDay,
} from '../ai-limit'

// 日本時間 2026-09-05 09:00（UTC では 00:00）
const NOON = new Date('2026-09-05T03:00:00.000Z')

describe('startOfJstDay', () => {
  it('日本時間の 0 時を返す', () => {
    // UTC の 0 時ではない。利用者の感覚と合わせるため日本時間で区切る
    expect(startOfJstDay(NOON).toISOString()).toBe('2026-09-04T15:00:00.000Z')
  })

  it('日本時間 0 時ちょうどは、その日の始まりになる', () => {
    const midnight = new Date('2026-09-04T15:00:00.000Z')
    expect(startOfJstDay(midnight).toISOString()).toBe('2026-09-04T15:00:00.000Z')
  })

  it('日本時間 0 時の直前は、前日の始まりになる', () => {
    const justBefore = new Date('2026-09-04T14:59:59.999Z')
    expect(startOfJstDay(justBefore).toISOString()).toBe('2026-09-03T15:00:00.000Z')
  })
})

describe('checkDailyLimit', () => {
  it('使っていなければ通す', () => {
    const result = checkDailyLimit({ calls: 0, tokens: 0 }, NOON)
    expect(result.allowed).toBe(true)
    expect(result.remainingCalls).toBe(DAILY_CALL_LIMIT)
    expect(result.remainingTokens).toBe(DAILY_TOKEN_LIMIT)
  })

  it('上限の 1 つ手前なら通す', () => {
    const result = checkDailyLimit(
      { calls: DAILY_CALL_LIMIT - 1, tokens: DAILY_TOKEN_LIMIT - 1 },
      NOON,
    )
    expect(result.allowed).toBe(true)
    expect(result.remainingCalls).toBe(1)
  })

  it('回数が上限に達したら止める', () => {
    const result = checkDailyLimit({ calls: DAILY_CALL_LIMIT, tokens: 0 }, NOON)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('calls')
  })

  it('トークン量が上限に達したら止める', () => {
    const result = checkDailyLimit({ calls: 0, tokens: DAILY_TOKEN_LIMIT }, NOON)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('tokens')
  })

  it('どちらか一方でも超えていれば止める', () => {
    // 回数が少なくても、巨大な資料を投げれば費用は伸びる
    const result = checkDailyLimit({ calls: 1, tokens: DAILY_TOKEN_LIMIT + 1 }, NOON)
    expect(result.allowed).toBe(false)
  })

  it('残りは 0 より下がらない', () => {
    // 上限を越えた記録が入っていても、負の数を画面に出さない
    const result = checkDailyLimit(
      { calls: DAILY_CALL_LIMIT + 10, tokens: DAILY_TOKEN_LIMIT + 999 },
      NOON,
    )
    expect(result.remainingCalls).toBe(0)
    expect(result.remainingTokens).toBe(0)
  })

  it('次に使えるようになる時刻は、翌日の日本時間 0 時', () => {
    const result = checkDailyLimit({ calls: DAILY_CALL_LIMIT, tokens: 0 }, NOON)
    expect(result.resetsAt.toISOString()).toBe('2026-09-05T15:00:00.000Z')
  })

  it('上限そのものは変わらない値として返す', () => {
    const result = checkDailyLimit({ calls: 3, tokens: 100 }, NOON)
    expect(result.callLimit).toBe(DAILY_CALL_LIMIT)
    expect(result.tokenLimit).toBe(DAILY_TOKEN_LIMIT)
  })
})

describe('上限値', () => {
  it('合意した値', () => {
    // 変更は費用に直結する。うっかり動かさないよう固定しておく
    expect(DAILY_CALL_LIMIT).toBe(50)
    expect(DAILY_TOKEN_LIMIT).toBe(300_000)
  })
})
