'use server'

import { revalidatePath } from 'next/cache'
import { type Result, err, ok } from '@/lib/domain/result'
import { validateWorkSettings } from '@/lib/domain/schedule'
import { createSupabaseWorkSettingsRepository } from '@/lib/repositories/work-settings'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function updateWorkSettingsAction(formData: FormData): Promise<Result<null>> {
  const workDays = formData
    .getAll('workDays')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))

  const validated = validateWorkSettings({
    workDays,
    workStart: String(formData.get('workStart') ?? ''),
    workEnd: String(formData.get('workEnd') ?? ''),
    dailyCapacityMinutes: Number(formData.get('dailyCapacityMinutes') ?? 0),
    timezone: String(formData.get('timezone') ?? 'Asia/Tokyo'),
  })
  if (!validated.ok) return validated

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseWorkSettingsRepository(supabase).save(user.id, validated.data)
  } catch {
    return err('UNKNOWN', '稼働条件を保存できませんでした。')
  }

  revalidatePath('/settings')
  return ok(null)
}
