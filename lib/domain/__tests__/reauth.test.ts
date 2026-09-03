import { describe, expect, it } from 'vitest'
import { REAUTH_TTL_MS, buildReauthToken, verifyReauthToken } from '../reauth'

const KEY = Buffer.alloc(32, 3).toString('base64')
const OTHER_KEY = Buffer.alloc(32, 4).toString('base64')
const USER = 'user-1'
const NOW = new Date('2026-09-03T00:00:00.000Z')

function later(ms: number): Date {
  return new Date(NOW.getTime() + ms)
}

describe('buildReauthToken / verifyReauthToken', () => {
  it('発行直後は通る', () => {
    const token = buildReauthToken(USER, NOW, KEY)
    expect(verifyReauthToken(token, USER, NOW, KEY)).toBe(true)
  })

  it('期限内なら通る', () => {
    const token = buildReauthToken(USER, NOW, KEY)
    expect(verifyReauthToken(token, USER, later(REAUTH_TTL_MS - 1000), KEY)).toBe(true)
  })

  it('期限を過ぎたら通らない', () => {
    const token = buildReauthToken(USER, NOW, KEY)
    expect(verifyReauthToken(token, USER, later(REAUTH_TTL_MS + 1000), KEY)).toBe(false)
  })

  it('期限ちょうどは通らない', () => {
    const token = buildReauthToken(USER, NOW, KEY)
    expect(verifyReauthToken(token, USER, later(REAUTH_TTL_MS), KEY)).toBe(false)
  })

  it('別の利用者では通らない', () => {
    // 取り違えると、他人の確認済み状態を借りられてしまう
    const token = buildReauthToken(USER, NOW, KEY)
    expect(verifyReauthToken(token, 'user-2', NOW, KEY)).toBe(false)
  })

  it('鍵が違えば通らない', () => {
    const token = buildReauthToken(USER, NOW, KEY)
    expect(verifyReauthToken(token, USER, NOW, OTHER_KEY)).toBe(false)
  })

  it('改竄されていれば通らない', () => {
    // 認証付き暗号のため、1 文字でも変えると復号に失敗する
    const token = buildReauthToken(USER, NOW, KEY)
    const tampered = `${token.slice(0, -2)}${token.endsWith('A') ? 'B' : 'A'}=`
    expect(verifyReauthToken(tampered, USER, NOW, KEY)).toBe(false)
  })

  it('空・壊れた値でも例外を投げない', () => {
    expect(verifyReauthToken('', USER, NOW, KEY)).toBe(false)
    expect(verifyReauthToken('こわれています', USER, NOW, KEY)).toBe(false)
  })

  it('鍵が未設定なら通らない', () => {
    const token = buildReauthToken(USER, NOW, KEY)
    expect(verifyReauthToken(token, USER, NOW, undefined)).toBe(false)
  })

  it('鍵の長さが不正でも例外を投げない', () => {
    expect(() => verifyReauthToken('x', USER, NOW, 'c2hvcnQ=')).not.toThrow()
    expect(verifyReauthToken('x', USER, NOW, 'c2hvcnQ=')).toBe(false)
  })

  it('利用者 ID が読み取れる形で残らない', () => {
    // 保存先は Cookie。中身がそのまま読めてはいけない
    expect(buildReauthToken(USER, NOW, KEY)).not.toContain(USER)
  })

  it('毎回異なる値になる', () => {
    // 同じ内容でも使い回せると、値の比較だけで推測されうる
    expect(buildReauthToken(USER, NOW, KEY)).not.toBe(buildReauthToken(USER, NOW, KEY))
  })
})
