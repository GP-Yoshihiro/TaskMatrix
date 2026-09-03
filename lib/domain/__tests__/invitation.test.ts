import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXPIRY_DAYS,
  INVITE_PREFIX,
  buildCode,
  displayPrefix,
  expiresAt,
  hashCode,
  invitationStatus,
  normalizeCode,
} from '../invitation'

const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

describe('buildCode', () => {
  it('接頭辞を付けて、貼り付けられる文字だけにする', () => {
    const code = buildCode(bytes)
    expect(code.startsWith(INVITE_PREFIX)).toBe(true)
    // URL やメールで折り返されても壊れない文字に限る
    expect(code.slice(INVITE_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('バイト列が違えば違うコードになる', () => {
    const other = new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9])
    expect(buildCode(bytes)).not.toBe(buildCode(other))
  })
})

describe('hashCode', () => {
  it('同じコードは同じハッシュになる', () => {
    expect(hashCode('inv_abc')).toBe(hashCode('inv_abc'))
  })

  it('違うコードは違うハッシュになる', () => {
    expect(hashCode('inv_abc')).not.toBe(hashCode('inv_abd'))
  })

  it('平文をそのまま返さない', () => {
    // 保存するのはこの値なので、元に戻せてはいけない
    expect(hashCode('inv_abc')).not.toContain('inv_abc')
  })
})

describe('displayPrefix', () => {
  it('先頭だけを見せ、全文は含めない', () => {
    const code = buildCode(bytes)
    const shown = displayPrefix(code)
    expect(code.startsWith(shown.replace('…', ''))).toBe(true)
    expect(shown).not.toBe(code)
  })
})

describe('normalizeCode', () => {
  it('前後の空白を落とす', () => {
    // メールから貼ると空白が付いてくる
    expect(normalizeCode('  inv_abc \n')).toBe('inv_abc')
  })

  it('大文字小文字は変えない', () => {
    // base64url は大文字小文字を区別する。潰すと別のコードになる
    expect(normalizeCode('inv_AbC')).toBe('inv_AbC')
  })
})

describe('expiresAt', () => {
  it('既定の日数だけ先の時刻を返す', () => {
    const now = new Date('2026-09-03T00:00:00.000Z')
    expect(expiresAt(now, DEFAULT_EXPIRY_DAYS)).toBe('2026-09-17T00:00:00.000Z')
  })

  it('日数を指定できる', () => {
    const now = new Date('2026-09-03T00:00:00.000Z')
    expect(expiresAt(now, 1)).toBe('2026-09-04T00:00:00.000Z')
  })
})

describe('invitationStatus', () => {
  const now = new Date('2026-09-10T00:00:00.000Z')
  const future = '2026-09-17T00:00:00.000Z'
  const past = '2026-09-01T00:00:00.000Z'

  it('未使用で期限内なら使える', () => {
    expect(
      invitationStatus({ usedAt: null, revokedAt: null, expiresAt: future }, now),
    ).toBe('active')
  })

  it('使用済みなら使えない', () => {
    expect(
      invitationStatus({ usedAt: past, revokedAt: null, expiresAt: future }, now),
    ).toBe('used')
  })

  it('無効化されていれば使えない', () => {
    expect(
      invitationStatus({ usedAt: null, revokedAt: past, expiresAt: future }, now),
    ).toBe('revoked')
  })

  it('期限を過ぎていれば使えない', () => {
    expect(
      invitationStatus({ usedAt: null, revokedAt: null, expiresAt: past }, now),
    ).toBe('expired')
  })

  it('使用済みは、期限切れより先に判定する', () => {
    // 「期限切れ」と出すと、待てば使えるかのように読める
    expect(
      invitationStatus({ usedAt: past, revokedAt: null, expiresAt: past }, now),
    ).toBe('used')
  })

  it('期限ちょうどは使えない', () => {
    expect(
      invitationStatus(
        { usedAt: null, revokedAt: null, expiresAt: now.toISOString() },
        now,
      ),
    ).toBe('expired')
  })
})
