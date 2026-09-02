import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from '../crypto'

const KEY = randomBytes(32).toString('base64')
const OTHER_KEY = randomBytes(32).toString('base64')
const SECRET = '1//0abcdefgHIJKLMNOP-google-refresh-token'

describe('encryptSecret / decryptSecret', () => {
  it('暗号化して復号すると元に戻る', () => {
    expect(decryptSecret(encryptSecret(SECRET, KEY), KEY)).toBe(SECRET)
  })

  it('暗号文に平文が含まれない', () => {
    // データベースが漏れたときに、そのまま読めてはならない
    const payload = encryptSecret(SECRET, KEY)

    expect(payload).not.toContain(SECRET)
    expect(Buffer.from(payload, 'base64').toString('utf8')).not.toContain(SECRET)
  })

  it('同じ平文でも毎回違う暗号文になる', () => {
    // 初期化ベクトルを使い回すと、同じ値かどうかが外から分かってしまう
    expect(encryptSecret(SECRET, KEY)).not.toBe(encryptSecret(SECRET, KEY))
  })

  it('鍵が違えば復号できない', () => {
    expect(decryptSecret(encryptSecret(SECRET, KEY), OTHER_KEY)).toBeNull()
  })

  it('暗号文を改竄すると復号できない', () => {
    // 認証タグが効いていることの確認
    const payload = encryptSecret(SECRET, KEY)
    const raw = Buffer.from(payload, 'base64')
    raw[raw.length - 1] ^= 0xff

    expect(decryptSecret(raw.toString('base64'), KEY)).toBeNull()
  })

  it('初期化ベクトルを改竄しても復号できない', () => {
    const payload = encryptSecret(SECRET, KEY)
    const raw = Buffer.from(payload, 'base64')
    raw[0] ^= 0xff

    expect(decryptSecret(raw.toString('base64'), KEY)).toBeNull()
  })

  it('壊れた入力を渡しても例外を投げず null を返す', () => {
    expect(decryptSecret('これは暗号文ではない', KEY)).toBeNull()
    expect(decryptSecret('', KEY)).toBeNull()
  })

  it('鍵の長さが 32 バイトでなければ例外を投げる', () => {
    // 短い鍵で暗号化してしまうと、弱いまま気付けない
    expect(() => encryptSecret(SECRET, Buffer.alloc(16).toString('base64'))).toThrow()
  })

  it('日本語を含む値も往復できる', () => {
    const value = 'トークン：あいうえお🔑'
    expect(decryptSecret(encryptSecret(value, KEY), KEY)).toBe(value)
  })
})
