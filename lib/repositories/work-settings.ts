import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkSettings } from '@/lib/domain/schedule'

export interface WorkSettingsRepository {
  find(userId: string): Promise<WorkSettings | null>
  save(userId: string, settings: WorkSettings): Promise<void>
}

type Row = {
  work_days: number[]
  work_start: string
  work_end: string
  daily_capacity_minutes: number
  timezone: string
}

/** DB の time 型は 'HH:MM:SS' で返るため 'HH:MM' に切り詰める */
function toHhMm(value: string): string {
  return value.slice(0, 5)
}

/**
 * 稼働条件（稼働日・時間帯・1 日の上限）。
 *
 * 行レベルセキュリティにより、自分のデータだけが見える。
 */
export function createSupabaseWorkSettingsRepository(
  supabase: SupabaseClient,
): WorkSettingsRepository {
  return {
    async find(userId) {
      const { data, error } = await supabase
        .from('work_settings')
        .select('work_days, work_start, work_end, daily_capacity_minutes, timezone')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null

      const row = data as Row
      return {
        workDays: row.work_days,
        workStart: toHhMm(row.work_start),
        workEnd: toHhMm(row.work_end),
        dailyCapacityMinutes: row.daily_capacity_minutes,
        timezone: row.timezone,
      }
    },

    async save(userId, settings) {
      const { error } = await supabase.from('work_settings').upsert(
        {
          user_id: userId,
          work_days: settings.workDays,
          work_start: settings.workStart,
          work_end: settings.workEnd,
          daily_capacity_minutes: settings.dailyCapacityMinutes,
          timezone: settings.timezone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      if (error) throw error
    },
  }
}
