'use server'

import { revalidatePath } from 'next/cache'
import { type Result, err, ok } from '@/lib/domain/result'
import { createSupabaseGoogleConnectionRepository } from '@/lib/repositories/google-connections'
import { createSupabaseScheduleRepository } from '@/lib/repositories/schedules'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { openGoogleSession } from '@/lib/usecases/google-session'
import { pullCalendar } from '@/lib/usecases/pull-calendar'
import { pushSchedules } from '@/lib/usecases/push-schedules'

const RECONNECT_MESSAGE =
  'Google との接続が切れています。連携し直してください。'

/** Google 側の変更を取り込む */
export async function pullCalendarAction(
  formData: FormData,
): Promise<Result<{ updated: number }>> {
  const projectId = String(formData.get('projectId') ?? '')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const connections = createSupabaseGoogleConnectionRepository(supabase)

  try {
    const session = await openGoogleSession(connections, user.id)
    if (!session.ok) {
      if (session.failure === 'not_connected') {
        return err('VALIDATION_ERROR', 'Google カレンダーと連携していません。')
      }
      if (session.failure === 'not_configured') {
        return err('SERVICE_NOT_CONFIGURED', 'Google 連携の設定が不足しています。')
      }
      if (session.failure === 'reconnect_required') {
        return err('UNAUTHENTICATED', RECONNECT_MESSAGE)
      }
      return err('NETWORK_ERROR', 'Google に接続できませんでした。')
    }

    const result = await pullCalendar(
      { schedules: createSupabaseScheduleRepository(supabase), connections },
      session.data,
      user.id,
    )

    if (!result.ok) {
      return result.failure === 'reconnect_required'
        ? err('UNAUTHENTICATED', RECONNECT_MESSAGE)
        : err('NETWORK_ERROR', 'Google に接続できませんでした。')
    }

    if (projectId) revalidatePath(`/projects/${projectId}/schedule`)
    return ok({ updated: result.updated })
  } catch {
    return err('UNKNOWN', '取り込みに失敗しました。')
  }
}

/** まだ Google に無い予定を書き出す */
export async function pushSchedulesAction(
  formData: FormData,
): Promise<Result<{ pushed: number; failed: number }>> {
  const projectId = String(formData.get('projectId') ?? '')
  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    const session = await openGoogleSession(
      createSupabaseGoogleConnectionRepository(supabase),
      user.id,
    )
    if (!session.ok) {
      if (session.failure === 'not_connected') {
        return err('VALIDATION_ERROR', 'Google カレンダーと連携していません。')
      }
      if (session.failure === 'reconnect_required') {
        return err('UNAUTHENTICATED', RECONNECT_MESSAGE)
      }
      return err('NETWORK_ERROR', 'Google に接続できませんでした。')
    }

    const result = await pushSchedules(
      createSupabaseScheduleRepository(supabase),
      session.data,
      projectId,
    )

    revalidatePath(`/projects/${projectId}/schedule`)
    return ok(result)
  } catch {
    return err('UNKNOWN', '書き出しに失敗しました。')
  }
}

/** 連携を解除する。Google 側のカレンダーは残す（消すと予定ごと失われるため） */
export async function disconnectGoogleAction(): Promise<Result<null>> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseGoogleConnectionRepository(supabase).remove(user.id)
    return ok(null)
  } catch {
    return err('UNKNOWN', '連携を解除できませんでした。')
  }
}
