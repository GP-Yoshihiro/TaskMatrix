import { decryptSecret, encryptSecret } from './crypto'

/**
 * 操作前のパスワード再確認。
 *
 * ログイン済みであることと、「今その人が操作していること」は別物である。
 * 席を離れた間に画面が開いたままでも、招待コードの発行や閲覧はできてしまう。
 * そこで、操作の直前にもう一度パスワードを求める。
 *
 * 確認できたことは Cookie に持たせるが、**中身は暗号化して利用者 ID と期限を封じる**。
 * 平文の印を置くと、値を作れば誰でも確認済みを名乗れてしまう。
 *
 * 印は**ログアウトで破棄する**（`signOutAction`）。時間が残っていても、
 * 一度離席の意思を示した以上は確認をやり直す。
 */

export const REAUTH_COOKIE = 'tm_reauth'

/** 確認が有効な時間。席を離れる程度の間で切れる長さにする */
export const REAUTH_TTL_MS = 10 * 60 * 1000

const SEPARATOR = ':'

/** 確認済みの印を作る。誰の・いつまでを封じ込める */
export function buildReauthToken(userId: string, now: Date, keyBase64: string): string {
  const expiresAt = now.getTime() + REAUTH_TTL_MS
  return encryptSecret(`${userId}${SEPARATOR}${expiresAt}`, keyBase64)
}

/**
 * 印が今も有効か。
 *
 * 復号できない（鍵違い・改竄・壊れた値）場合はすべて false を返す。
 * 呼び出し側が「確認されていない」の一言で扱えるようにするため。
 */
export function verifyReauthToken(
  token: string,
  userId: string,
  now: Date,
  keyBase64: string | undefined,
): boolean {
  if (!keyBase64 || token === '') return false

  let payload: string | null = null
  try {
    payload = decryptSecret(token, keyBase64)
  } catch {
    // 鍵の長さが不正なときはここに来る
    return false
  }
  if (!payload) return false

  const separatorAt = payload.lastIndexOf(SEPARATOR)
  if (separatorAt < 0) return false

  // 利用者 ID を照合する。取り違えると他人の確認済み状態を借りられてしまう
  if (payload.slice(0, separatorAt) !== userId) return false

  const expiresAt = Number(payload.slice(separatorAt + 1))
  if (!Number.isFinite(expiresAt)) return false

  return now.getTime() < expiresAt
}
