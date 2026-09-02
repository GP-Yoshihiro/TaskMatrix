import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * リフレッシュトークンの暗号化。
 *
 * 連携トークン（api_tokens）はハッシュで済んだが、こちらは実際に Google へ送るため
 * 平文が必要になる。ハッシュ化できないので、鍵をデータベースの外に置いて暗号化する。
 * データベースのダンプが漏れても、鍵が無ければ復号できない。
 */

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const TAG_LENGTH = 16

function toKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64')

  if (key.length !== KEY_LENGTH) {
    // 短い鍵のまま気付かずに運用するのを防ぐ
    throw new Error('暗号化鍵は 32 バイトである必要があります。')
  }

  return key
}

/**
 * 暗号化する。初期化ベクトルは毎回作り直す。
 * 使い回すと、同じ値かどうかが暗号文を見るだけで分かってしまう。
 */
export function encryptSecret(plain: string, keyBase64: string): string {
  const key = toKey(keyBase64)
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])

  // 初期化ベクトル・認証タグ・暗号文をまとめて 1 つの値にする
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')
}

/**
 * 復号する。鍵違い・改竄・壊れた入力はすべて null を返す。
 * 呼び出し側が「復号できなかった」の一言で扱えるようにするため。
 */
export function decryptSecret(payload: string, keyBase64: string): string | null {
  const key = toKey(keyBase64)

  try {
    const raw = Buffer.from(payload, 'base64')
    if (raw.length <= IV_LENGTH + TAG_LENGTH) return null

    const iv = raw.subarray(0, IV_LENGTH)
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = raw.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    // 認証タグが合わない（改竄・鍵違い）場合はここに来る
    return null
  }
}
