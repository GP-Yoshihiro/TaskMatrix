import { describe, expect, it } from 'vitest'
import { DELETION_NOTICE, matchesConfirmation } from '../account'

const EMAIL = 'yamada@example.com'

describe('matchesConfirmation', () => {
  it('一致すれば通す', () => {
    expect(matchesConfirmation(EMAIL, EMAIL)).toBe(true)
  })

  it('前後の空白は無視する', () => {
    expect(matchesConfirmation(`  ${EMAIL}  `, EMAIL)).toBe(true)
  })

  it('大文字小文字は区別しない', () => {
    // 見た目の違いで弾いても、意図の確認にはならない
    expect(matchesConfirmation('YAMADA@EXAMPLE.COM', EMAIL)).toBe(true)
  })

  it('違うアドレスは通さない', () => {
    expect(matchesConfirmation('tanaka@example.com', EMAIL)).toBe(false)
  })

  it('一部だけでは通さない', () => {
    expect(matchesConfirmation('yamada', EMAIL)).toBe(false)
  })

  it('空欄では通さない', () => {
    expect(matchesConfirmation('', EMAIL)).toBe(false)
    expect(matchesConfirmation('   ', EMAIL)).toBe(false)
  })

  it('比較対象が空なら、何を入れても通さない', () => {
    // 取り違えで全員が削除できてしまう事態を防ぐ
    expect(matchesConfirmation('', '')).toBe(false)
    expect(matchesConfirmation('なんでも', '')).toBe(false)
  })
})

describe('DELETION_NOTICE', () => {
  it('復元できないことを伝える', () => {
    expect(DELETION_NOTICE.join('')).toContain('復元できません')
  })

  it('Google 側に残るものがあることを伝える', () => {
    // 「全部消えた」と誤解すると、Google 側の予定が残り続ける
    expect(DELETION_NOTICE.join('')).toContain('Google 側に残ります')
  })
})
