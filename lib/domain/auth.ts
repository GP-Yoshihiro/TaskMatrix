import { z } from 'zod'
import { type AppError, type Result, err, ok } from './result'

/** パスワードの最小文字数 */
export const PASSWORD_MIN_LENGTH = 8

const schema = z.object({
  email: z.email().trim(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
})

export function validateCredentials(
  email: string,
  password: string,
): Result<{ email: string; password: string }> {
  const parsed = schema.safeParse({ email: email.trim(), password })

  if (!parsed.success) {
    const hasEmailIssue = parsed.error.issues.some((issue) => issue.path[0] === 'email')
    return err(
      'VALIDATION_ERROR',
      hasEmailIssue
        ? 'メールアドレスの形式が正しくありません。'
        : `パスワードは ${PASSWORD_MIN_LENGTH} 文字以上で入力してください。`,
    )
  }

  return ok(parsed.data)
}


/** Supabase Auth が返すエラーのうち、判定に使う部分だけを見る */
type AuthFailure = {
  code?: string
  status?: number
  message?: string
} | null | undefined

/**
 * 認証の失敗を、利用者が次に取るべき行動が分かる形に翻訳する。
 *
 * すべてを「パスワードが正しくありません」に丸めてはいけない。
 * 実際に API キーの設定ミスでログインできない障害が起き、
 * 原因の切り分けに時間を要したため、設定・障害・資格情報を区別する。
 */
export function describeAuthFailure(failure: AuthFailure): AppError {
  const code = failure?.code ?? ''
  const status = failure?.status ?? 0
  const message = failure?.message ?? ''

  if (code === 'email_not_confirmed') {
    return {
      code: 'UNAUTHENTICATED',
      message: 'メールアドレスの確認が完了していません。確認メールをご確認ください。',
    }
  }

  if (code === 'invalid_credentials') {
    return {
      code: 'UNAUTHENTICATED',
      message: 'メールアドレスまたはパスワードが正しくありません。',
    }
  }

  if (code === 'over_request_rate_limit' || status === 429) {
    return {
      code: 'UNAUTHENTICATED',
      message: '試行回数が上限に達しました。しばらく待ってからお試しください。',
    }
  }

  // API キーの誤りや未設定。資格情報の誤りと取り違えると原因に辿り着けない
  if (/invalid api key/i.test(message) || status === 401 || status === 403) {
    return {
      code: 'AI_NOT_CONFIGURED',
      message: '認証サービスに接続できませんでした。サーバーの設定をご確認ください。',
    }
  }

  if (status >= 500) {
    return {
      code: 'UNKNOWN',
      message: '認証サービスが一時的に応答していません。時間をおいてお試しください。',
    }
  }

  return {
    code: 'UNAUTHENTICATED',
    message: 'メールアドレスまたはパスワードが正しくありません。',
  }
}
