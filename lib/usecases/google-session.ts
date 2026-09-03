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
 * 失効の印を書き換える。
 *
 * 値が変わるときだけ書く。開くたびに書き込むのは無駄な更新になる。
 * 書き込みに失敗しても本来の処理は止めない（印は付随的な情報のため）。
 */
async function updateMark(
  repository: GoogleConnectionRepository,
  userId: string,
  current: boolean,
  next: boolean,
): Promise<void> {
  if (current === next) return

  try {
    await repository.setNeedsReconnect(userId, next)
  } catch {
    // 印を残せなくても、呼び出し元の判断は変わらない
  }
}

/**
 * 保存済みの接続からアクセストークンを用意する。
 *
 * リフレッシュトークンは使う直前に復号する。
 *
 * **繋ぎ直しが要る状態を検知したら印を立てる。**
 * 立てないと画面は「連携済み」と表示し続け、
 * 利用者は操作して失敗するまで失効に気付けない。
 *
 * 一時的な通信の失敗では印を立てない。
 * 繋ぎ直しが不要な場面で促すと、利用者を無駄に不安にさせる。
 */
export async function openGoogleSession(
  repository: GoogleConnectionRepository,
  userId: string,
): Promise<SessionResult> {
  const config = readGoogleConfig()
  if (!config) return { ok: false, failure: 'not_configured' }

  const connection = await repository.find(userId)
  if (!connection) return { ok: false, failure: 'not_connected' }

  const marked = connection.needsReconnect

  // 鍵が変わった・改竄されたなどで復号できない場合は繋ぎ直すしかない
  const refreshToken = decryptSecret(
    connection.refreshTokenEncrypted,
    config.encryptionKey,
  )
  if (!refreshToken) {
    await updateMark(repository, userId, marked, true)
    return { ok: false, failure: 'reconnect_required' }
  }

  const refreshed = await refreshAccessToken({
    refreshToken,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  })

  if (!refreshed.ok) {
    if (refreshed.failure === 'reconnect_required') {
      await updateMark(repository, userId, marked, true)
    }
    return { ok: false, failure: refreshed.failure }
  }

  // 繋ぎ直せていれば印を消す
  await updateMark(repository, userId, marked, false)

  return {
    ok: true,
    data: {
      accessToken: refreshed.data,
      calendarId: connection.calendarId,
      syncToken: connection.syncToken,
    },
  }
}
