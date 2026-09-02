import { createHash } from 'node:crypto'

/**
 * 連携トークン。
 *
 * ショートカットは Cookie を持てないため、画面と同じセッション認証が使えない。
 * トークンで本人と操作範囲を決める。
 *
 * 平文は保存しない。データベースが読まれても、そのままでは使えないようにするため。
 */

export const TOKEN_PREFIX = 'tmx_'

/** 一覧に見せる桁数。どのトークンかを見分けられれば足りる */
const DISPLAY_LENGTH = TOKEN_PREFIX.length + 8

export const RATE_LIMIT_PER_MINUTE = 60
export const RATE_WINDOW_MS = 60_000

/** ランダムなバイト列からトークンを作る。URL やヘッダーへそのまま貼れる文字にする */
export function buildToken(bytes: Uint8Array): string {
  return TOKEN_PREFIX + Buffer.from(bytes).toString('base64url')
}

/** 保存するのはこのハッシュだけ。平文は保存しない */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 一覧表示用。全文は発行直後の 1 回しか見せない */
export function displayPrefix(token: string): string {
  return `${token.slice(0, DISPLAY_LENGTH)}…`
}

/** `Authorization: Bearer <token>` からトークンを取り出す */
export function parseBearer(header: string | null): string | null {
  if (!header) return null

  const match = /^bearer\s+(\S+)\s*$/i.exec(header)
  return match ? match[1] : null
}

export type RateState = {
  windowStartedAt: string | null
  count: number
}

export type RateDecision = RateState & {
  windowStartedAt: string
  allowed: boolean
  /** 止めたときに待つべき秒数。通したときは 0 */
  retryAfterSeconds: number
}

/**
 * 回数制限の判定。固定窓とする。
 *
 * 厳密な移動窓ではないが、個人利用の誤操作・暴走を止めるには十分であり、
 * トークン行に 2 列持つだけで済む（専用の記録表や Redis を必要としない）。
 */
export function nextRateState(current: RateState, now: Date): RateDecision {
  const startedAt = current.windowStartedAt ? Date.parse(current.windowStartedAt) : null
  const withinWindow =
    startedAt !== null && now.getTime() - startedAt < RATE_WINDOW_MS

  if (!withinWindow) {
    return {
      windowStartedAt: now.toISOString(),
      count: 1,
      allowed: true,
      retryAfterSeconds: 0,
    }
  }

  if (current.count >= RATE_LIMIT_PER_MINUTE) {
    const remainingMs = startedAt + RATE_WINDOW_MS - now.getTime()

    return {
      windowStartedAt: current.windowStartedAt as string,
      count: current.count,
      allowed: false,
      retryAfterSeconds: Math.ceil(remainingMs / 1000),
    }
  }

  return {
    windowStartedAt: current.windowStartedAt as string,
    count: current.count + 1,
    allowed: true,
    retryAfterSeconds: 0,
  }
}
