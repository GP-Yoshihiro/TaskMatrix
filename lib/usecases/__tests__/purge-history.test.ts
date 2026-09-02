import { describe, expect, it, vi } from 'vitest'
import {
  CAPACITY_LIMIT_BYTES,
  CAPACITY_THRESHOLD,
  PURGE_BATCH,
} from '@/lib/domain/capacity'
import { type PurgeGateway, purgeHistory } from '../purge-history'

const OVER = CAPACITY_LIMIT_BYTES * CAPACITY_THRESHOLD + 1
const UNDER = 12 * 1024 * 1024

function createGateway(overrides: Partial<PurgeGateway> = {}) {
  const deleted: unknown[] = []

  const gateway: PurgeGateway = {
    databaseSizeBytes: async () => UNDER,
    listLockedFileIds: async () => [],
    deleteOldest: async (input) => {
      deleted.push(input)
      return input.limit
    },
    ...overrides,
  }

  return { gateway, deleted }
}

describe('purgeHistory', () => {
  it('余裕があれば何もしない', async () => {
    const { gateway, deleted } = createGateway()
    const result = await purgeHistory(gateway, 'p1')

    expect(result.removed).toBe(0)
    expect(deleted).toEqual([])
  })

  it('余裕があれば保護対象すら調べない', async () => {
    // 消さないと決まっているのに問い合わせるのは無駄
    const listLockedFileIds = vi.fn(async () => [])
    const { gateway } = createGateway({ listLockedFileIds })

    await purgeHistory(gateway, 'p1')

    expect(listLockedFileIds).not.toHaveBeenCalled()
  })

  it('閾値を超えたら古い順に消す', async () => {
    const { gateway, deleted } = createGateway({
      databaseSizeBytes: async () => OVER,
    })

    const result = await purgeHistory(gateway, 'p1')

    expect(result.removed).toBe(PURGE_BATCH)
    expect(deleted).toEqual([
      { projectId: 'p1', protectedFileIds: [], limit: PURGE_BATCH },
    ])
  })

  it('ロック付きのファイルの履歴は消さない', async () => {
    // 利用者が意図して守った記録を、容量の都合で失わせない
    const { gateway, deleted } = createGateway({
      databaseSizeBytes: async () => OVER,
      listLockedFileIds: async () => ['file-a', 'file-b'],
    })

    await purgeHistory(gateway, 'p1')

    expect(deleted).toEqual([
      { projectId: 'p1', protectedFileIds: ['file-a', 'file-b'], limit: PURGE_BATCH },
    ])
  })

  it('使用量をそのまま返す', async () => {
    const { gateway } = createGateway({ databaseSizeBytes: async () => OVER })

    expect((await purgeHistory(gateway, 'p1')).usedBytes).toBe(OVER)
  })

  it('一度に消すのは決めた件数まで', async () => {
    // 一度に大量に消すと処理が長引く
    const { gateway, deleted } = createGateway({
      databaseSizeBytes: async () => CAPACITY_LIMIT_BYTES,
    })

    await purgeHistory(gateway, 'p1')

    expect((deleted[0] as { limit: number }).limit).toBe(PURGE_BATCH)
  })
})
