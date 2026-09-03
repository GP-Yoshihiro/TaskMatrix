import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  GoogleConnection,
  GoogleConnectionRepository,
} from '@/lib/repositories/google-connections'
import { openGoogleSession } from '../google-session'

const refreshAccessToken = vi.fn()
const decryptSecret = vi.fn()

vi.mock('@/lib/google/calendar', () => ({
  refreshAccessToken: (...args: unknown[]) => refreshAccessToken(...args),
}))

vi.mock('@/lib/domain/crypto', () => ({
  decryptSecret: (...args: unknown[]) => decryptSecret(...args),
}))

vi.mock('@/lib/google/config', () => ({
  readGoogleConfig: () => ({
    clientId: 'id',
    clientSecret: 'secret',
    encryptionKey: 'key',
  }),
}))

function connection(overrides: Partial<GoogleConnection> = {}): GoogleConnection {
  return {
    id: 'c1',
    refreshTokenEncrypted: 'encrypted',
    calendarId: 'cal-1',
    syncToken: 'tok',
    connectedAt: '2026-09-02T08:26:00Z',
    lastSyncedAt: null,
    needsReconnect: false,
    ...overrides,
  }
}

function createRepository(
  current: GoogleConnection | null,
  overrides: Partial<GoogleConnectionRepository> = {},
) {
  const marks: { userId: string; value: boolean }[] = []

  const repository: GoogleConnectionRepository = {
    find: async () => current,
    save: async () => {},
    updateSync: async () => {},
    setNeedsReconnect: async (userId, value) => {
      marks.push({ userId, value })
    },
    remove: async () => {},
    ...overrides,
  }

  return { repository, marks }
}

describe('openGoogleSession', () => {
  beforeEach(() => {
    refreshAccessToken.mockReset()
    decryptSecret.mockReset()
    decryptSecret.mockReturnValue('1//refresh-token')
  })

  it('更新できれば操作に必要な情報を返す', async () => {
    refreshAccessToken.mockResolvedValue({ ok: true, data: 'access-token' })
    const { repository } = createRepository(connection())

    const result = await openGoogleSession(repository, 'user-1')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({
        accessToken: 'access-token',
        calendarId: 'cal-1',
        syncToken: 'tok',
      })
    }
  })

  it('失効していたら印を立てる', async () => {
    // 立てないと「連携済み」と表示され続け、押すまで失効に気付けない
    refreshAccessToken.mockResolvedValue({ ok: false, failure: 'reconnect_required' })
    const { repository, marks } = createRepository(connection())

    const result = await openGoogleSession(repository, 'user-1')

    expect(result.ok).toBe(false)
    expect(marks).toEqual([{ userId: 'user-1', value: true }])
  })

  it('復号できないときも印を立てる', async () => {
    // 鍵が変わった場合など。繋ぎ直さないと直らない
    decryptSecret.mockReturnValue(null)
    const { repository, marks } = createRepository(connection())

    const result = await openGoogleSession(repository, 'user-1')

    expect(result.ok).toBe(false)
    expect(marks).toEqual([{ userId: 'user-1', value: true }])
  })

  it('印が立っていた状態で更新できたら消す', async () => {
    refreshAccessToken.mockResolvedValue({ ok: true, data: 'access-token' })
    const { repository, marks } = createRepository(
      connection({ needsReconnect: true }),
    )

    await openGoogleSession(repository, 'user-1')

    expect(marks).toEqual([{ userId: 'user-1', value: false }])
  })

  it('すでに正しい印なら書き込まない', async () => {
    // 開くたびに書き込むのは無駄な更新になる
    refreshAccessToken.mockResolvedValue({ ok: true, data: 'access-token' })
    const { repository, marks } = createRepository(connection({ needsReconnect: false }))

    await openGoogleSession(repository, 'user-1')

    expect(marks).toEqual([])
  })

  it('通信の失敗では印を立てない', async () => {
    // 一時的な不調で「再接続が必要」と言うと、利用者を無駄に不安にさせる
    refreshAccessToken.mockResolvedValue({ ok: false, failure: 'request_failed' })
    const { repository, marks } = createRepository(connection())

    const result = await openGoogleSession(repository, 'user-1')

    expect(result.ok).toBe(false)
    expect(marks).toEqual([])
  })

  it('印の書き込みに失敗しても結果は変わらない', async () => {
    // 印は付随的な情報。これで本来の処理を止めない
    refreshAccessToken.mockResolvedValue({ ok: false, failure: 'reconnect_required' })
    const { repository } = createRepository(connection(), {
      setNeedsReconnect: async () => {
        throw new Error('書き込みに失敗')
      },
    })

    const result = await openGoogleSession(repository, 'user-1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failure).toBe('reconnect_required')
  })

  it('連携していなければその旨を返す', async () => {
    const { repository, marks } = createRepository(null)

    const result = await openGoogleSession(repository, 'user-1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failure).toBe('not_connected')
    expect(marks).toEqual([])
  })
})
