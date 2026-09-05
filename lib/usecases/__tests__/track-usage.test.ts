import { describe, expect, it, vi } from 'vitest'
import { DAILY_CALL_LIMIT, DAILY_TOKEN_LIMIT } from '@/lib/domain/ai-limit'
import { err, ok } from '@/lib/domain/result'
import type { AiUsage } from '@/lib/domain/usage'
import type { AiUsageRepository, RecordUsageInput } from '@/lib/repositories/ai-usage'
import { trackUsage } from '../track-usage'

const USAGE: AiUsage = {
  model: 'gemini-3.5-flash',
  inputTokens: 3200,
  outputTokens: 850,
  inputChars: 12_000,
}

function createRepository(overrides: Partial<AiUsageRepository> = {}) {
  const recorded: RecordUsageInput[] = []

  const repository: AiUsageRepository = {
    record: async (input) => {
      recorded.push(input)
    },
    recentDurations: async () => [],
    listSince: async () => ({ logs: [], truncated: false }),
    usageSince: async () => ({ calls: 0, tokens: 0 }),
    listRecent: async () => [],
    ...overrides,
  }

  return { repository, recorded }
}

/** 呼ぶたびに 0ms, 18_234ms を返す時計 */
function fakeClock(...values: number[]) {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}

const context = {
  userId: 'user-1',
  projectId: 'project-1',
  operation: 'answer_question' as const,
}

describe('trackUsage', () => {
  it('成功した使用量と所要時間を記録する', async () => {
    const { repository, recorded } = createRepository()

    const result = await trackUsage(
      repository,
      { ...context, now: fakeClock(0, 18_234) },
      async () => ok({ answer: 'はい', usage: USAGE }),
    )

    expect(result.ok).toBe(true)
    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({
      userId: 'user-1',
      projectId: 'project-1',
      operation: 'answer_question',
      usage: USAGE,
      durationMs: 18_234,
      status: 'succeeded',
      errorCode: '',
    })
  })

  it('所要時間を結果に添えて返す', async () => {
    const { repository } = createRepository()

    const result = await trackUsage(
      repository,
      { ...context, now: fakeClock(1_000, 21_000) },
      async () => ok({ answer: 'はい', usage: USAGE }),
    )

    expect(result.ok && result.data.durationMs).toBe(20_000)
    expect(result.ok && result.data.answer).toBe('はい')
  })

  it('失敗も記録する（失敗してもトークンは消費されるため）', async () => {
    const { repository, recorded } = createRepository()

    const result = await trackUsage(
      repository,
      { ...context, now: fakeClock(0, 5_000) },
      async () => err('AI_MODEL_UNAVAILABLE', 'AI が混雑しています。'),
    )

    expect(result.ok).toBe(false)
    expect(recorded[0]).toMatchObject({
      status: 'failed',
      errorCode: 'AI_MODEL_UNAVAILABLE',
      durationMs: 5_000,
    })
  })

  it('失敗時のトークンは 0 とする（応答が無く実数が分からないため推定しない）', async () => {
    const { repository, recorded } = createRepository()

    await trackUsage(repository, context, async () =>
      err('AI_REQUEST_FAILED', '失敗しました。'),
    )

    expect(recorded[0].usage).toEqual({
      model: '',
      inputTokens: 0,
      outputTokens: 0,
      inputChars: 0,
    })
  })

  it('記録に失敗しても AI の結果は返す', async () => {
    // 記録は付随的な機能。これが原因で本来の処理が失敗するのは本末転倒
    const { repository } = createRepository({
      record: async () => {
        throw new Error('ai_usage_logs への書き込みに失敗')
      },
    })

    const result = await trackUsage(repository, context, async () =>
      ok({ answer: '記録は失敗したが回答は返る', usage: USAGE }),
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.data.answer).toBe('記録は失敗したが回答は返る')
  })

  it('記録に失敗してもエラー結果はそのまま返す', async () => {
    const { repository } = createRepository({
      record: async () => {
        throw new Error('書き込み失敗')
      },
    })

    const result = await trackUsage(repository, context, async () =>
      err('NO_INDEXED_CONTENT', '検索用データがありません。'),
    )

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.code).toBe('NO_INDEXED_CONTENT')
  })

  it('本体が例外を投げたら記録してから投げ直す', async () => {
    const { repository, recorded } = createRepository()

    await expect(
      trackUsage(repository, context, async () => {
        throw new Error('想定外')
      }),
    ).rejects.toThrow('想定外')

    expect(recorded[0]).toMatchObject({ status: 'failed', errorCode: 'UNKNOWN' })
  })

  it('本体は 1 度だけ呼ぶ', async () => {
    const { repository } = createRepository()
    const run = vi.fn(async () => ok({ usage: USAGE }))

    await trackUsage(repository, context, run)

    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('trackUsage の 1 日の上限', () => {
  const CONTEXT = {
    userId: 'u1',
    projectId: 'p1',
    operation: 'extract_tasks' as const,
    now: () => new Date('2026-09-05T03:00:00.000Z').getTime(),
  }

  it('上限に達していれば、AI を呼ばずに止める', async () => {
    const { repository } = createRepository({
      usageSince: async () => ({ calls: DAILY_CALL_LIMIT, tokens: 0 }),
    })
    const run = vi.fn()

    const result = await trackUsage(repository, CONTEXT, run)

    expect(result.ok).toBe(false)
    // 呼んでしまえばトークンは消費される。手前で止まらなければ意味がない
    expect(run).not.toHaveBeenCalled()
  })

  it('止めたときは、上限といつ戻るかを伝える', async () => {
    const { repository } = createRepository({
      usageSince: async () => ({ calls: DAILY_CALL_LIMIT, tokens: 0 }),
    })

    const result = await trackUsage(repository, CONTEXT, vi.fn())

    if (result.ok) throw new Error('止まっていない')
    expect(result.error.code).toBe('RATE_LIMITED')
    expect(result.error.message).toContain('50 回')
    expect(result.error.message).toContain('9/6')
  })

  it('トークン量の超過でも止める', async () => {
    const { repository } = createRepository({
      usageSince: async () => ({ calls: 1, tokens: DAILY_TOKEN_LIMIT }),
    })

    const result = await trackUsage(repository, CONTEXT, vi.fn())

    if (result.ok) throw new Error('止まっていない')
    expect(result.error.message).toContain('300,000')
  })

  it('上限内なら、これまでどおり実行する', async () => {
    const { repository } = createRepository({
      usageSince: async () => ({ calls: 1, tokens: 100 }),
    })
    const run = vi.fn(async () => ok({ usage: USAGE }))

    const result = await trackUsage(repository, CONTEXT, run)

    expect(result.ok).toBe(true)
    expect(run).toHaveBeenCalledOnce()
  })

  it('集計に失敗しても実行を止めない', async () => {
    // 上限は費用の歯止めであって、数えられないことを理由に
    // 機能そのものを止めるのは行き過ぎ
    const { repository } = createRepository({
      usageSince: async () => {
        throw new Error('集計できません')
      },
    })
    const run = vi.fn(async () => ok({ usage: USAGE }))

    const result = await trackUsage(repository, CONTEXT, run)

    expect(result.ok).toBe(true)
    expect(run).toHaveBeenCalledOnce()
  })

  it('止めたときは使用量を記録しない', async () => {
    // 実際には何も使っていない。記録すると回数がさらに増えてしまう
    const { repository, recorded } = createRepository({
      usageSince: async () => ({ calls: DAILY_CALL_LIMIT, tokens: 0 }),
    })

    await trackUsage(repository, CONTEXT, vi.fn())

    expect(recorded).toHaveLength(0)
  })
})

describe('上限に達したときの知らせ', () => {
  const BASE = {
    userId: 'u1',
    projectId: 'p1',
    operation: 'extract_tasks' as const,
    now: () => new Date('2026-09-05T03:00:00.000Z').getTime(),
  }

  it('止めたときに、理由を添えて知らせる', async () => {
    const { repository } = createRepository({
      usageSince: async () => ({ calls: DAILY_CALL_LIMIT, tokens: 0 }),
    })
    const onLimitReached = vi.fn(async () => {})

    await trackUsage(repository, { ...BASE, onLimitReached }, vi.fn())

    expect(onLimitReached).toHaveBeenCalledWith('calls')
  })

  it('トークン量で止めたときは、その理由を渡す', async () => {
    const { repository } = createRepository({
      usageSince: async () => ({ calls: 0, tokens: DAILY_TOKEN_LIMIT }),
    })
    const onLimitReached = vi.fn(async () => {})

    await trackUsage(repository, { ...BASE, onLimitReached }, vi.fn())

    expect(onLimitReached).toHaveBeenCalledWith('tokens')
  })

  it('上限内なら知らせない', async () => {
    const { repository } = createRepository({
      usageSince: async () => ({ calls: 1, tokens: 100 }),
    })
    const onLimitReached = vi.fn(async () => {})

    await trackUsage(repository, { ...BASE, onLimitReached }, async () => ok({ usage: USAGE }))

    expect(onLimitReached).not.toHaveBeenCalled()
  })

  it('知らせに失敗しても、止めた結果は変わらない', async () => {
    // 通知は付随的な機能であり、これが原因で挙動が変わってはいけない
    const { repository } = createRepository({
      usageSince: async () => ({ calls: DAILY_CALL_LIMIT, tokens: 0 }),
    })
    const onLimitReached = vi.fn(async () => {
      throw new Error('知らせられません')
    })

    const result = await trackUsage(repository, { ...BASE, onLimitReached }, vi.fn())

    if (result.ok) throw new Error('止まっていない')
    expect(result.error.code).toBe('RATE_LIMITED')
  })
})
