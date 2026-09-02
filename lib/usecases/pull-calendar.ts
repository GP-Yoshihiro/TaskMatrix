import { diffSchedule } from '@/lib/domain/calendar-sync'
import { listChanges } from '@/lib/google/calendar'
import type { GoogleConnectionRepository } from '@/lib/repositories/google-connections'
import type { ScheduleRepository } from '@/lib/repositories/schedules'
import type { GoogleSession } from './google-session'

export type PullResult =
  | { ok: true; updated: number }
  | { ok: false; failure: 'reconnect_required' | 'request_failed' }

/**
 * Google 側の日時の変更を取り込む。
 *
 * 差分同期の印（syncToken）で、前回以降に変わった予定だけを取る。
 * 印が古くなっていたら全件を取り直して印を作り直す。
 *
 * 取り込むのは日時だけ。Google 側の削除・新規作成は取り込まない
 * （TaskMatrix の予定は必ずタスクに紐づくため）。
 */
export async function pullCalendar(
  deps: { schedules: ScheduleRepository; connections: GoogleConnectionRepository },
  session: GoogleSession,
  userId: string,
): Promise<PullResult> {
  let result = await listChanges(session.accessToken, session.calendarId, session.syncToken)

  // 印が古い。全件を取り直す
  if (!result.ok && result.failure === 'sync_token_expired') {
    result = await listChanges(session.accessToken, session.calendarId, '')
  }

  if (!result.ok) {
    return {
      ok: false,
      failure: result.failure === 'reconnect_required' ? 'reconnect_required' : 'request_failed',
    }
  }

  const changes = result.data.changes.filter((change) => change.id)

  const locals = await deps.schedules.findByGoogleEventIds(changes.map((c) => c.id))
  const byEventId = new Map(locals.map((local) => [local.googleEventId, local]))

  let updated = 0

  for (const change of changes) {
    const local = byEventId.get(change.id)
    // こちらに無い予定は、Google 側で作られたもの。取り込まない
    if (!local) continue

    const diff = diffSchedule(local, change)
    if (!diff.changed) continue

    await deps.schedules.updateTimes(local.id, {
      startsAt: diff.startsAt,
      endsAt: diff.endsAt,
    })
    updated += 1
  }

  // 次回の続きを覚える。取れなかった場合は次回に全件取り直す
  await deps.connections.updateSync(userId, {
    syncToken: result.data.nextSyncToken,
    lastSyncedAt: new Date().toISOString(),
  })

  return { ok: true, updated }
}
