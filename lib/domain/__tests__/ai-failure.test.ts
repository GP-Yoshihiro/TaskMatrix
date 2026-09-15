import { describe, expect, it } from 'vitest'
import { AI_FAILURE_MESSAGE, describeAiFailure, isQuotaError, isRetryableAiError } from '../ai-failure'

class Timeout extends Error {
  constructor() {
    super('時間切れ')
    this.name = 'TimeoutError'
  }
}

describe('isQuotaError', () => {
  it('429 は利用上限とみなす', () => {
    expect(isQuotaError({ status: 429 })).toBe(true)
  })

  it('本文に quota があれば利用上限とみなす', () => {
    // 状態番号が取れない経路でも見分けられるようにする
    expect(isQuotaError(new Error('You exceeded your current quota'))).toBe(true)
  })

  it('RESOURCE_EXHAUSTED も利用上限とみなす', () => {
    expect(isQuotaError(new Error('RESOURCE_EXHAUSTED'))).toBe(true)
  })

  it('500 は利用上限ではない', () => {
    expect(isQuotaError({ status: 500 })).toBe(false)
  })

  it('時間切れは利用上限ではない', () => {
    expect(isQuotaError(new Timeout())).toBe(false)
  })
})

describe('isRetryableAiError', () => {
  it('時間切れは次のモデルを試す', () => {
    expect(isRetryableAiError(new Timeout())).toBe(true)
  })

  it('429 と 5xx は次のモデルを試す', () => {
    expect(isRetryableAiError({ status: 429 })).toBe(true)
    expect(isRetryableAiError({ status: 503 })).toBe(true)
  })

  it('400 は試し直さない', () => {
    // 送り方が悪いのだから、モデルを変えても同じ
    expect(isRetryableAiError({ status: 400 })).toBe(false)
  })
})

describe('describeAiFailure', () => {
  it('利用上限は、そうと分かるように伝える', () => {
    // 「混雑しています」では、待てば直るのか課金が要るのか判断できない
    const failure = describeAiFailure({ ranOutOfTime: false, hitQuota: true })
    expect(failure.code).toBe('RATE_LIMITED')
    expect(failure.message).toContain('利用上限')
  })

  it('利用上限は、時間切れより優先して伝える', () => {
    // 上限に当たっているなら、対象を減らしても直らない
    expect(describeAiFailure({ ranOutOfTime: true, hitQuota: true }).code).toBe('RATE_LIMITED')
  })

  it('時間切れは、対象を減らすよう促す', () => {
    const failure = describeAiFailure({ ranOutOfTime: true, hitQuota: false })
    expect(failure.code).toBe('AI_TIMEOUT')
    expect(failure.message).toBe(AI_FAILURE_MESSAGE.timeout)
  })

  it('どちらでもなければ、混雑として伝える', () => {
    expect(describeAiFailure({ ranOutOfTime: false, hitQuota: false }).code).toBe(
      'AI_MODEL_UNAVAILABLE',
    )
  })
})
