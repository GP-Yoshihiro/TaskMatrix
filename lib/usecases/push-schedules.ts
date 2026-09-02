import { toGoogleEvent } from '@/lib/domain/calendar-sync'
import { insertEvent } from '@/lib/google/calendar'
import type { ScheduleRepository } from '@/lib/repositories/schedules'
import type { GoogleSession } from './google-session'

/**
 * まだ Google に無い予定を作る。
 *
 * TaskMatrix には確定済み予定の変更・削除の操作が無いため、
 * 書き出しは取りこぼしの回収だけでよい。
 *
 * 途中で失敗しても、作れた分は google_event_id が入る。
 * 残りは次回の書き出しで拾われるので、作り直しにはならない。
 */
export async function pushSchedules(
  schedules: ScheduleRepository,
  session: GoogleSession,
  projectId: string,
): Promise<{ pushed: number; failed: number }> {
  const pending = await schedules.listUnsynced(projectId)

  let pushed = 0
  let failed = 0

  for (const schedule of pending) {
    const created = await insertEvent(
      session.accessToken,
      session.calendarId,
      toGoogleEvent({
        taskTitle: schedule.taskTitle,
        reason: schedule.reason,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
      }),
    )

    if (!created.ok) {
      failed += 1
      continue
    }

    await schedules.setGoogleEventId(schedule.id, created.data)
    pushed += 1
  }

  return { pushed, failed }
}
