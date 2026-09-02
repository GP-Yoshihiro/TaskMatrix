import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GoogleConnectionRepository } from '@/lib/repositories/google-connections'
import type { ScheduleRepository } from '@/lib/repositories/schedules'
import { pullCalendar } from '../pull-calendar'

const listChanges = vi.fn()

vi.mock('@/lib/google/calendar', () => ({
  listChanges: (...args: unknown[]) => listChanges(...args),
}))

const session = { accessToken: 'at', calendarId: 'cal', syncToken: 'token-1' }

const local = {
  id: 'sch-1',
  googleEventId: 'ev-1',
  startsAt: '2026-09-03T00:00:00+00:00',
  endsAt: '2026-09-03T01:00:00+00:00',
}

function createDeps(overrides: Partial<ScheduleRepository> = {}) {
  const updated: unknown[] = []
  const synced: unknown[] = []

  const schedules = {
    listByProject: vi.fn(async () => []),
    createMany: vi.fn(async () => 0),
    remove: vi.fn(async () => {}),
    listUnsynced: vi.fn(async () => []),
    setGoogleEventId: vi.fn(async () => {}),
    findByGoogleEventIds: vi.fn(async () => [local]),
    updateTimes: vi.fn(async (id: string, input: unknown) => {
      updated.push({ id, ...(input as object) })
    }),
    ...overrides,
  } as unknown as ScheduleRepository

  const connections = {
    find: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    updateSync: vi.fn(async (userId: string, input: unknown) => {
      synced.push({ userId, ...(input as object) })
    }),
    remove: vi.fn(async () => {}),
  } as unknown as GoogleConnectionRepository

  return { deps: { schedules, connections }, updated, synced }
}

const change = (over: Record<string, unknown> = {}) => ({
  id: 'ev-1',
  status: 'confirmed',
  start: '2026-09-03T05:00:00+00:00',
  end: '2026-09-03T06:00:00+00:00',
  ...over,
})

describe('pullCalendar', () => {
  beforeEach(() => {
    listChanges.mockReset()
  })

  it('日時が変わった予定を更新する', async () => {
    listChanges.mockResolvedValue({
      ok: true,
      data: { changes: [change()], nextSyncToken: 'token-2' },
    })

    const { deps, updated } = createDeps()
    const result = await pullCalendar(deps, session, 'user-1')

    expect(result).toEqual({ ok: true, updated: 1 })
    expect(updated).toEqual([
      {
        id: 'sch-1',
        startsAt: '2026-09-03T05:00:00+00:00',
        endsAt: '2026-09-03T06:00:00+00:00',
      },
    ])
  })

  it('日時が同じなら更新しない', async () => {
    listChanges.mockResolvedValue({
      ok: true,
      data: {
        changes: [change({ start: local.startsAt, end: local.endsAt })],
        nextSyncToken: 'token-2',
      },
    })

    const { deps, updated } = createDeps()
    const result = await pullCalendar(deps, session, 'user-1')

    expect(result).toEqual({ ok: true, updated: 0 })
    expect(updated).toEqual([])
  })

  it('Google 側で削除された予定は取り込まない', async () => {
    listChanges.mockResolvedValue({
      ok: true,
      data: { changes: [change({ status: 'cancelled' })], nextSyncToken: 'token-2' },
    })

    const { deps, updated } = createDeps()

    expect(await pullCalendar(deps, session, 'user-1')).toEqual({ ok: true, updated: 0 })
    expect(updated).toEqual([])
  })

  it('こちらに無い予定（Google 側で作られたもの）は取り込まない', async () => {
    listChanges.mockResolvedValue({
      ok: true,
      data: { changes: [change({ id: 'ev-unknown' })], nextSyncToken: 'token-2' },
    })

    const { deps, updated } = createDeps({
      findByGoogleEventIds: vi.fn(async () => []),
    })

    expect(await pullCalendar(deps, session, 'user-1')).toEqual({ ok: true, updated: 0 })
    expect(updated).toEqual([])
  })

  it('次回のための印を保存する', async () => {
    listChanges.mockResolvedValue({
      ok: true,
      data: { changes: [], nextSyncToken: 'token-2' },
    })

    const { deps, synced } = createDeps()
    await pullCalendar(deps, session, 'user-1')

    expect(synced).toHaveLength(1)
    expect(synced[0]).toMatchObject({ userId: 'user-1', syncToken: 'token-2' })
  })

  it('印が古ければ全件を取り直す', async () => {
    listChanges
      .mockResolvedValueOnce({ ok: false, failure: 'sync_token_expired' })
      .mockResolvedValueOnce({
        ok: true,
        data: { changes: [change()], nextSyncToken: 'token-3' },
      })

    const { deps, updated } = createDeps()
    const result = await pullCalendar(deps, session, 'user-1')

    expect(result).toEqual({ ok: true, updated: 1 })
    expect(updated).toHaveLength(1)
    // 2 回目は印を空にして呼ぶ
    expect(listChanges).toHaveBeenNthCalledWith(2, 'at', 'cal', '')
  })

  it('接続が切れていたら再接続が必要だと返す', async () => {
    listChanges.mockResolvedValue({ ok: false, failure: 'reconnect_required' })

    const { deps, synced } = createDeps()
    const result = await pullCalendar(deps, session, 'user-1')

    expect(result).toEqual({ ok: false, failure: 'reconnect_required' })
    // 失敗したときは印を書き換えない（次回に取りこぼさないため）
    expect(synced).toEqual([])
  })
})
