import { createHash } from 'node:crypto'

/**
 * 招待コード。
 *
 * 登録できる人を、運用者が渡したコードを持つ人だけに限る。
 * 費用が理由で、AI のキーはサーバー側の 1 本を全員で共有しているため、
 * 登録者の利用がそのまま運用者の請求になる。
 *
 * 平文は保存しない。データベースが読まれても、そのままでは使えないようにするため。
 */

export const INVITE_PREFIX = 'inv_'

/** 一覧に見せる桁数。どのコードかを見分けられれば足りる */
const DISPLAY_LENGTH = INVITE_PREFIX.length + 6

/** 発行時の既定の有効日数 */
export const DEFAULT_EXPIRY_DAYS = 14

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** ランダムなバイト列からコードを作る。メールに貼っても壊れない文字にする */
export function buildCode(bytes: Uint8Array): string {
  return INVITE_PREFIX + Buffer.from(bytes).toString('base64url')
}

/** 保存するのはこのハッシュだけ。平文は保存しない */
export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

/** 一覧表示用。全文は発行直後の 1 回しか見せない */
export function displayPrefix(code: string): string {
  return `${code.slice(0, DISPLAY_LENGTH)}…`
}

/**
 * 入力されたコードを整える。
 *
 * 前後の空白は落とす（メールから貼ると付いてくる）。
 * 大文字小文字は変えない。base64url は区別するため、潰すと別のコードになる。
 */
export function normalizeCode(input: string): string {
  return input.trim()
}

/** 発行時刻から有効期限を決める */
export function expiresAt(now: Date, days: number): string {
  return new Date(now.getTime() + days * MS_PER_DAY).toISOString()
}

export type InvitationState = {
  usedAt: string | null
  revokedAt: string | null
  expiresAt: string
}

export type InvitationStatus = 'active' | 'used' | 'revoked' | 'expired'

/**
 * コードが今使えるか。
 *
 * 判定の順序に意味がある。使用済みを期限切れより先に見るのは、
 * 「期限切れ」と伝えると待てば使えるかのように読めてしまうため。
 */
export function invitationStatus(state: InvitationState, now: Date): InvitationStatus {
  if (state.usedAt) return 'used'
  if (state.revokedAt) return 'revoked'
  // 期限ちょうどは切れているものとして扱う
  if (new Date(state.expiresAt).getTime() <= now.getTime()) return 'expired'
  return 'active'
}
