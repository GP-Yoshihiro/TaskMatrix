import type { SupabaseClient } from '@supabase/supabase-js'
import type { LimitReason } from '@/lib/domain/limit-notification'

/** 親の画面に出す 1 件 */
export type LimitNotice = {
  id: string
  userId: string
  /** 表示名。未設定ならメールアドレス */
  name: string
  reason: LimitReason
  reachedOn: string
  createdAt: string
}

/** 一度に見せる件数。溜め込んでも読まれないため */
export const NOTICE_LIMIT = 20

export interface LimitNotificationRepository {
  /** 上限に達したことを残す。同じ人の同じ日は 1 件だけ */
  record(input: { userId: string; reachedOn: string; reason: LimitReason }): Promise<void>
  /** 親が未確認のもの。自分自身の分は除く */
  listUnread(excludeUserId: string): Promise<LimitNotice[]>
  markAllRead(): Promise<void>
}

type Row = {
  id: string
  user_id: string
  reason: LimitReason
  reached_on: string
  created_at: string
  profiles: { display_name: string | null; email: string | null } | null
}

export function createSupabaseLimitNotificationRepository(
  supabase: SupabaseClient,
): LimitNotificationRepository {
  return {
    async record(input) {
      // 同じ人の同じ日は 1 件だけ。すでにあれば何もしない。
      // 上限後の操作をすべて残すと、同じ内容が並んで気付けなくなる
      const { error } = await supabase.from('limit_notifications').upsert(
        {
          user_id: input.userId,
          reached_on: input.reachedOn,
          reason: input.reason,
        },
        { onConflict: 'user_id,reached_on', ignoreDuplicates: true },
      )
      if (error) throw error
    },

    async listUnread(excludeUserId) {
      const { data, error } = await supabase
        .from('limit_notifications')
        .select('id, user_id, reason, reached_on, created_at, profiles(display_name, email)')
        .is('read_at', null)
        .neq('user_id', excludeUserId)
        .order('created_at', { ascending: false })
        .limit(NOTICE_LIMIT)
      if (error) throw error

      return ((data ?? []) as unknown as Row[]).map((row) => ({
        id: row.id,
        userId: row.user_id,
        // 表示名が無ければメールアドレス。どちらも無ければ誰か分からないため印を出す
        name: row.profiles?.display_name || row.profiles?.email || '（不明な利用者）',
        reason: row.reason,
        reachedOn: row.reached_on,
        createdAt: row.created_at,
      }))
    },

    async markAllRead() {
      const { error } = await supabase
        .from('limit_notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
      if (error) throw error
    },
  }
}
