import { describe, expect, it } from 'vitest'
import { encryptSecret } from '@/lib/domain/crypto'
import { revealInvitations } from '../reveal-invitations'

// テスト専用の 32 バイト鍵
const KEY = Buffer.alloc(32, 7).toString('base64')
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64')

function row(overrides: Partial<{ id: string; codeEncrypted: string }> = {}) {
  return {
    id: 'a',
    displayPrefix: 'inv_abc…',
    note: '',
    createdAt: '2026-09-03T00:00:00.000Z',
    expiresAt: '2026-09-17T00:00:00.000Z',
    usedAt: null,
    revokedAt: null,
    codeEncrypted: encryptSecret('inv_secret', KEY),
    ...overrides,
  }
}

describe('revealInvitations', () => {
  it('復号したコードを添えて返す', () => {
    const [result] = revealInvitations([row()], KEY)
    expect(result.code).toBe('inv_secret')
  })

  it('元の項目はそのまま残す', () => {
    const [result] = revealInvitations([row({ id: 'x' })], KEY)
    expect(result.id).toBe('x')
    expect(result.displayPrefix).toBe('inv_abc…')
  })

  it('暗号化前に発行されたものは null にする', () => {
    // この機能より前に発行したコードは復元できない
    const [result] = revealInvitations([row({ codeEncrypted: '' })], KEY)
    expect(result.code).toBeNull()
  })

  it('鍵が違えば null にする。例外は投げない', () => {
    // 1 件でも落ちると画面全体が出なくなる
    const [result] = revealInvitations([row()], OTHER_KEY)
    expect(result.code).toBeNull()
  })

  it('壊れた値でも null にする', () => {
    const [result] = revealInvitations([row({ codeEncrypted: 'こわれています' })], KEY)
    expect(result.code).toBeNull()
  })

  it('鍵が未設定なら、すべて null にする', () => {
    const [result] = revealInvitations([row()], undefined)
    expect(result.code).toBeNull()
  })

  it('鍵の長さが不正でも例外を投げない', () => {
    // 設定を誤ったときに画面が真っ白になるのを避ける
    expect(() => revealInvitations([row()], 'c2hvcnQ=')).not.toThrow()
    expect(revealInvitations([row()], 'c2hvcnQ=')[0].code).toBeNull()
  })

  it('暗号化した値そのものは返さない', () => {
    // 画面に渡す必要が無く、渡せば漏れる面が増える
    const [result] = revealInvitations([row()], KEY)
    expect(JSON.stringify(result)).not.toContain(row().codeEncrypted.slice(0, 20))
  })
})
