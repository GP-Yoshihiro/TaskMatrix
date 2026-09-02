import { describe, expect, it } from 'vitest'
import {
  MAX_DISPLAY_NAME_LENGTH,
  resolveAuthorName,
  validateDisplayName,
} from '../profile'

describe('resolveAuthorName', () => {
  it('表示名があればそれを使う', () => {
    expect(
      resolveAuthorName({
        displayName: '山田',
        email: 'yamada@example.com',
        snapshot: '古い名前',
      }),
    ).toBe('山田')
  })

  it('表示名が無ければメールアドレスの @ より前を使う', () => {
    expect(
      resolveAuthorName({ displayName: '', email: 'yamada@example.com', snapshot: '' }),
    ).toBe('yamada')
  })

  it('アカウントが消えていれば記録時の名前を使う', () => {
    // 退会後も「誰の操作か分からない」状態にしない
    expect(
      resolveAuthorName({ displayName: null, email: null, snapshot: '退職した田中' }),
    ).toBe('退職した田中')
  })

  it('表示名の改名は過去の履歴にも反映される', () => {
    // 記録時の名前より、今の表示名を優先する
    expect(
      resolveAuthorName({ displayName: '新しい名前', email: null, snapshot: '古い名前' }),
    ).toBe('新しい名前')
  })

  it('空白だけの表示名は未登録として扱う', () => {
    expect(
      resolveAuthorName({ displayName: '   ', email: 'a@example.com', snapshot: '' }),
    ).toBe('a')
  })

  it('何も無ければ不明とする', () => {
    expect(resolveAuthorName({ displayName: null, email: null, snapshot: '' })).toBe('不明')
  })
})

describe('validateDisplayName', () => {
  it('通常の名前は通す', () => {
    expect(validateDisplayName('山田 太郎')).toBeNull()
  })

  it('空でも通す（未登録として扱うため）', () => {
    expect(validateDisplayName('')).toBeNull()
  })

  it('長すぎる名前は拒否する', () => {
    // 1 行に収める一覧で長すぎる名前は扱えない
    expect(validateDisplayName('あ'.repeat(MAX_DISPLAY_NAME_LENGTH + 1))).toContain(
      '文字以内',
    )
  })

  it('上限ちょうどは通す', () => {
    expect(validateDisplayName('あ'.repeat(MAX_DISPLAY_NAME_LENGTH))).toBeNull()
  })
})
