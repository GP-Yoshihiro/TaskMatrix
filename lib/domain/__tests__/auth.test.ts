import { describe, expect, it } from 'vitest'
import {
  PASSWORD_MIN_LENGTH,
  describeAuthFailure,
  validateCredentials,
} from '@/lib/domain/auth'

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

describe('describeAuthFailure', () => {
  it('資格情報の誤りは認証エラーとして扱う', () => {
    const error = describeAuthFailure({ code: 'invalid_credentials', status: 400 })
    expect(error.code).toBe('UNAUTHENTICATED')
    expect(error.message).toContain('パスワード')
  })

  it('メール未確認は専用のメッセージを返す', () => {
    const error = describeAuthFailure({ code: 'email_not_confirmed', status: 400 })
    expect(error.code).toBe('UNAUTHENTICATED')
    expect(error.message).toContain('確認')
    expect(error.message).not.toContain('パスワードが正しくありません')
  })

  it('APIキーの誤りを資格情報の誤りと取り違えない', () => {
    // 設定ミスをパスワード誤りに丸めると原因の切り分けができなくなる
    const error = describeAuthFailure({ message: 'Invalid API key', status: 401 })
    expect(error.code).toBe('AI_NOT_CONFIGURED')
    expect(error.message).toContain('設定')
    expect(error.message).not.toContain('パスワードが正しくありません')
  })

  it('サーバー障害は一時的な問題として扱う', () => {
    const error = describeAuthFailure({ status: 503 })
    expect(error.code).toBe('UNKNOWN')
    expect(error.message).toContain('時間をおいて')
  })

  it('レート制限は専用のメッセージを返す', () => {
    const error = describeAuthFailure({ code: 'over_request_rate_limit', status: 429 })
    expect(error.message).toContain('回数')
  })

  it('未知のエラーでも例外を投げない', () => {
    expect(() => describeAuthFailure({})).not.toThrow()
    expect(() => describeAuthFailure(null)).not.toThrow()
  })
})
