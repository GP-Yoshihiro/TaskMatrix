import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_ESTIMATE_MS, ESTIMATE_SAMPLE_SIZE } from '@/lib/domain/usage'
import type { AiUsageRepository } from '@/lib/repositories/ai-usage'
import { loadEstimate } from '../load-estimate'

function createRepository(overrides: Partial<AiUsageRepository> = {}): AiUsageRepository {
  return {
    record: async () => {},
    recentDurations: async () => [],
    listSince: async () => ({ logs: [], truncated: false }),
    usageSince: async () => ({ calls: 0, tokens: 0 }),
    listRecent: async () => [],
    ...overrides,
  }
}

describe('loadEstimate', () => {
  it('実績から中央値を求める', async () => {
    const repository = createRepository({
      recentDurations: async () => [18_000, 20_000, 22_000],
    })

    expect(await loadEstimate(repository, 'answer_question')).toEqual({
      ms: 20_000,
      isMeasured: true,
    })
  })

  it('予測に使う件数を指定して読む', async () => {
    const recentDurations = vi.fn(async () => [])
    await loadEstimate(createRepository({ recentDurations }), 'extract_tasks')

    expect(recentDurations).toHaveBeenCalledWith('extract_tasks', ESTIMATE_SAMPLE_SIZE)
  })

  it('記録が読めなくても初期値を返す（画面は出す）', async () => {
    const repository = createRepository({
      recentDurations: async () => {
        throw new Error('ai_usage_logs を読めない')
      },
    })

    expect(await loadEstimate(repository, 'build_index')).toEqual({
      ms: DEFAULT_ESTIMATE_MS.build_index,
      isMeasured: false,
    })
  })
})
