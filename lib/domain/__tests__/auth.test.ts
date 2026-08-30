import { describe, expect, it } from 'vitest'
import { PASSWORD_MIN_LENGTH, validateCredentials } from '@/lib/domain/auth'

describe('validateCredentials', () => {
  it('正しいメールとパスワードを受け入れる', () => {
    const result = validateCredentials('user@example.com', 'password123')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.email).toBe('user@example.com')
  })

  it('メールアドレスの前後の空白を取り除く', () => {
    const result = validateCredentials('  user@example.com  ', 'password123')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.email).toBe('user@example.com')
  })

  it('メール形式でない文字列を拒否する', () => {
    const result = validateCredentials('not-an-email', 'password123')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('空のメールを拒否する', () => {
    const result = validateCredentials('', 'password123')
    expect(result.ok).toBe(false)
  })

  it('最小長未満のパスワードを拒否する', () => {
    const result = validateCredentials('user@example.com', 'a'.repeat(PASSWORD_MIN_LENGTH - 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('ちょうど最小長のパスワードを受け入れる', () => {
    const result = validateCredentials('user@example.com', 'a'.repeat(PASSWORD_MIN_LENGTH))
    expect(result.ok).toBe(true)
  })

  it('パスワードの最小長は 8 文字である', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })
})
