import type { SupabaseClient } from '@supabase/supabase-js'

export type GoogleConnection = {
  id: string
  /** 暗号化されたまま返す。復号は使う直前に行う */
  refreshTokenEncrypted: string
  calendarId: string
  syncToken: string
  connectedAt: string
  lastSyncedAt: string | null
  /** 失効を検知した印。繋ぎ直すまで立ったまま */
  needsReconnect: boolean
}

export interface GoogleConnectionRepository {
  find(userId: string): Promise<GoogleConnection | null>
  save(input: {
    userId: string
    refreshTokenEncrypted: string
    calendarId: string
  }): Promise<void>
  updateSync(userId: string, input: { syncToken: string; lastSyncedAt: string }): Promise<void>
  /** 失効の印を立てる・消す */
  setNeedsReconnect(userId: string, value: boolean): Promise<void>
  remove(userId: string): Promise<void>
}

type Row = {
  id: string
  refresh_token_encrypted: string
  calendar_id: string
  sync_token: string
  connected_at: string
  last_synced_at: string | null
  needs_reconnect: boolean
}

/**
 * Google 連携。リフレッシュトークンは暗号化して保存する。
 *
 * 行レベルセキュリティにより、自分のデータだけが見える。
 */
export function createSupabaseGoogleConnectionRepository(
  supabase: SupabaseClient,
): GoogleConnectionRepository {
  return {
    async find(userId) {
      const { data, error } = await supabase
        .from('google_connections')
        .select('id, refresh_token_encrypted, calendar_id, sync_token, connected_at, last_synced_at, needs_reconnect')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null

      const row = data as Row
      return {
        id: row.id,
        refreshTokenEncrypted: row.refresh_token_encrypted,
        calendarId: row.calendar_id,
        syncToken: row.sync_token,
        connectedAt: row.connected_at,
        lastSyncedAt: row.last_synced_at,
        needsReconnect: row.needs_reconnect,
      }
    },

    /** 再接続でも 1 行のままにする */
    async save(input) {
      const { error } = await supabase.from('google_connections').upsert(
        {
          user_id: input.userId,
          refresh_token_encrypted: input.refreshTokenEncrypted,
          calendar_id: input.calendarId,
          sync_token: '',
          connected_at: new Date().toISOString(),
          // 繋ぎ直したので印は消す
          needs_reconnect: false,
        },
        { onConflict: 'user_id' },
      )
      if (error) throw error
    },

    async updateSync(userId, input) {
      const { error } = await supabase
        .from('google_connections')
        .update({ sync_token: input.syncToken, last_synced_at: input.lastSyncedAt })
        .eq('user_id', userId)
      if (error) throw error
    },

    async setNeedsReconnect(userId, value) {
      const { error } = await supabase
        .from('google_connections')
        .update({ needs_reconnect: value })
        .eq('user_id', userId)
      if (error) throw error
    },

    async remove(userId) {
      const { error } = await supabase
        .from('google_connections')
        .delete()
        .eq('user_id', userId)
      if (error) throw error
    },
  }
}
