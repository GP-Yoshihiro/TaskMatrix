'use server'

import { revalidatePath } from 'next/cache'
import { type Result, err, ok } from '@/lib/domain/result'
import { isTaskWeight } from '@/lib/domain/schedule'
import type { WithUsage } from '@/lib/domain/usage'
import { createGeminiSchedulePlanner } from '@/lib/gemini/plan-schedule-client'
import { createSupabaseAiUsageRepository } from '@/lib/repositories/ai-usage'
import { createSupabaseScheduleRepository } from '@/lib/repositories/schedules'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'
import { createSupabaseWorkSettingsRepository } from '@/lib/repositories/work-settings'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  type PlanScheduleOutput,
  type ScheduleDraft,
  planScheduleForProject,
} from '@/lib/usecases/plan-schedule'
import { trackUsage } from '@/lib/usecases/track-usage'

/** その日のうちにブラウザ側で使うため、稼働条件のタイムゾーンで今日の日付を作る */
function todayIn(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

export async function planScheduleAction(
  formData: FormData,
): Promise<Result<WithUsage<PlanScheduleOutput>>> {
  const projectId = String(formData.get('projectId') ?? '')
  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const workSettings = createSupabaseWorkSettingsRepository(supabase)

  try {
    const settings = await workSettings.find(user.id)
    return await trackUsage(
      createSupabaseAiUsageRepository(supabase),
      { userId: user.id, projectId, operation: 'plan_schedule' },
      () =>
        planScheduleForProject(
          {
            tasks: createSupabaseTaskRepository(supabase),
            schedules: createSupabaseScheduleRepository(supabase),
            workSettings,
            planner: createGeminiSchedulePlanner(),
          },
          {
            projectId,
            userId: user.id,
            today: todayIn(settings?.timezone ?? 'Asia/Tokyo'),
          },
        ),
    )
  } catch {
    return err('UNKNOWN', 'スケジュールを算出できませんでした。')
  }
}

export async function confirmSchedulesAction(formData: FormData): Promise<Result<number>> {
  const projectId = String(formData.get('projectId') ?? '')
  const payload = String(formData.get('drafts') ?? '[]')

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  let drafts: ScheduleDraft[]
  try {
    drafts = JSON.parse(payload) as ScheduleDraft[]
  } catch {
    return err('VALIDATION_ERROR', '確定する予定を解釈できませんでした。')
  }

  if (!Array.isArray(drafts) || drafts.length === 0) {
    return err('VALIDATION_ERROR', '確定する予定を選んでください。')
  }

  // 画面から送られた日時を再検証する。クライアントの値を信用しない。
  // 重複していても拒否しない。可否は利用者が警告ダイアログで判断済みのため。
  for (const draft of drafts) {
    const start = Date.parse(draft.startsAt)
    const end = Date.parse(draft.endsAt)
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return err('INVALID_SCHEDULE_RANGE', '開始と終了の日時が正しくありません。')
    }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    const count = await createSupabaseScheduleRepository(supabase).createMany(
      drafts.map((draft) => ({
        projectId,
        taskId: draft.taskId,
        startsAt: new Date(draft.startsAt).toISOString(),
        endsAt: new Date(draft.endsAt).toISOString(),
        reason: draft.reason,
        weight: isTaskWeight(draft.weight) ? draft.weight : 'normal',
        createdBy: user.id,
      })),
    )

    revalidatePath(`/projects/${projectId}/schedule`)
    return ok(count)
  } catch {
    return err('UNKNOWN', '予定を確定できませんでした。')
  }
}
