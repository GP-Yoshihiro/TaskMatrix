import { describe, expect, it, vi } from 'vitest'
import { RATE_LIMIT_PER_MINUTE, buildToken, hashToken } from '@/lib/domain/api-token'
import type { ApiTokenRepository, TokenAuthRow } from '@/lib/repositories/api-tokens'
import { authenticateToken } from '../authenticate-token'

const TOKEN = buildToken(new Uint8Array(32).fill(9))
const NOW = new Date('2026-09-01T10:00:30Z')

const validRow: TokenAuthRow = {
  id: 'token-1',
  projectId: 'project-1',
  userId: 'user-1',
  rateWindowStartedAt: null,
  rateCount: 0,
}

function createRepository(
  row: TokenAuthRow | null,
  overrides: Partial<ApiTokenRepository> = {},
) {
  const touched: unknown[] = []

  const repository: ApiTokenRepository = {
    create: async () => {
      throw new Error('未使用')
    },
    listByProject: async () => [],
    deleteById: async () => {},
    findByHash: async () => row,
    touch: async (id, input) => {
      touched.push({ id, ...input })
    },
    ...overrides,
  }

  return { repository, touched }
}

describe('authenticateToken', () => {
  it('正しいトークンなら操作範囲を返す', async () => {
    const { repository } = createRepository(validRow)
    const result = await authenticateToken(repository, `Bearer ${TOKEN}`, NOW)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toMatchObject({
        tokenId: 'token-1',
        projectId: 'project-1',
        userId: 'user-1',
      })
    }
  })

  it('平文ではなくハッシュで照合する', async () => {
    const findByHash = vi.fn(async () => validRow)
    const { repository } = createRepository(validRow, { findByHash })

    await authenticateToken(repository, `Bearer ${TOKEN}`, NOW)

    expect(findByHash).toHaveBeenCalledWith(hashToken(TOKEN))
    expect(findByHash).not.toHaveBeenCalledWith(TOKEN)
  })

  it('存在しないトークンと形式違いで同じ結果を返す', async () => {
    // 理由を書き分けると、有効なトークンの探索を助けてしまう
    const { repository: missing } = createRepository(null)
    const unknown = await authenticateToken(missing, `Bearer ${TOKEN}`, NOW)

    const { repository: present } = createRepository(validRow)
    const malformed = await authenticateToken(present, 'Basic xxx', NOW)
    const absent = await authenticateToken(present, null, NOW)

    expect(unknown.ok).toBe(false)
    expect(malformed.ok).toBe(false)
    expect(absent.ok).toBe(false)

    if (!unknown.ok && !malformed.ok && !absent.ok) {
      expect(malformed.error).toEqual(unknown.error)
      expect(absent.error).toEqual(unknown.error)
    }
  })

  it('エラーメッセージにトークンを含めない', async () => {
    const { repository } = createRepository(null)
    const result = await authenticateToken(repository, `Bearer ${TOKEN}`, NOW)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).not.toContain(TOKEN)
      expect(JSON.stringify(result.error)).not.toContain(TOKEN)
    }
  })

  it('利用のたびに最終利用日時と回数を記録する', async () => {
    const { repository, touched } = createRepository(validRow)
    await authenticateToken(repository, `Bearer ${TOKEN}`, NOW)

    expect(touched).toEqual([
      {
        id: 'token-1',
        lastUsedAt: NOW.toISOString(),
        rateWindowStartedAt: NOW.toISOString(),
        rateCount: 1,
      },
    ])
  })

  it('回数を超えたら別のエラーで止める（429 を返せるように）', async () => {
    const { repository } = createRepository({
      ...validRow,
      rateWindowStartedAt: '2026-09-01T10:00:00Z',
      rateCount: RATE_LIMIT_PER_MINUTE,
    })

    const result = await authenticateToken(repository, `Bearer ${TOKEN}`, NOW)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RATE_LIMITED')
  })

  it('回数を超えたときは待つべき秒数を伝える', async () => {
    const { repository } = createRepository({
      ...validRow,
      rateWindowStartedAt: '2026-09-01T10:00:00Z',
      rateCount: RATE_LIMIT_PER_MINUTE,
    })

    const result = await authenticateToken(repository, `Bearer ${TOKEN}`, NOW)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.retryAfterSeconds).toBe(30)
  })

  it('回数を超えたら数を増やさない', async () => {
    const { repository, touched } = createRepository({
      ...validRow,
      rateWindowStartedAt: '2026-09-01T10:00:00Z',
      rateCount: RATE_LIMIT_PER_MINUTE,
    })

    await authenticateToken(repository, `Bearer ${TOKEN}`, NOW)

    expect(touched).toEqual([])
  })

  it('記録に失敗しても認証は通す', async () => {
    // 記録は付随的な機能。これで API が使えなくなるのは本末転倒
    const { repository } = createRepository(validRow, {
      touch: async () => {
        throw new Error('更新に失敗')
      },
    })

    const result = await authenticateToken(repository, `Bearer ${TOKEN}`, NOW)

    expect(result.ok).toBe(true)
  })
})
