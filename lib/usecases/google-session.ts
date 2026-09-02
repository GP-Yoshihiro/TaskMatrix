import { decryptSecret } from '@/lib/domain/crypto'
import { type GoogleFailure, refreshAccessToken } from '@/lib/google/calendar'
import { readGoogleConfig } from '@/lib/google/config'
import type { GoogleConnectionRepository } from '@/lib/repositories/google-connections'

export type GoogleSession = {
  accessToken: string
  calendarId: string
  syncToken: string
}

export type SessionResult =
  | { ok: true; data: GoogleSession }
  | { ok: false; failure: GoogleFailure | 'not_connected' | 'not_configured' }

/**
 * 保存済みの接続からアクセストークンを用意する。
 *
 * リフレッシュトークンは使う直前に復号する。復号できない（鍵が変わった・
 * 改竄された）場合は再接続を促す。黙って同期されない状態を放置しない。
 */
export async function openGoogleSession(
  repository: GoogleConnectionRepository,
  userId: string,
): Promise<SessionResult> {
  const config = readGoogleConfig()
  if (!config) return { ok: false, failure: 'not_configured' }

  const connection = await repository.find(userId)
  if (!connection) return { ok: false, failure: 'not_connected' }

  const refreshToken = decryptSecret(
    connection.refreshTokenEncrypted,
    config.encryptionKey,
  )
  if (!refreshToken) return { ok: false, failure: 'reconnect_required' }

  const refreshed = await refreshAccessToken({
    refreshToken,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  })
  if (!refreshed.ok) return { ok: false, failure: refreshed.failure }

  return {
    ok: true,
    data: {
      accessToken: refreshed.data,
      calendarId: connection.calendarId,
      syncToken: connection.syncToken,
    },
  }
}
