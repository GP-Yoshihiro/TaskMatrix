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
type AuthFailure =
  | {
      code?: string
      status?: number
      message?: string
      name?: string
    }
  | null
  | undefined

/**
 * 認証サービスに到達できなかったのかを判定する。
 *
 * 「到達できなかった」と「認証されていない」は区別しなければならない。
 * 混同すると、通信が不安定なだけの利用者を勝手にログアウト扱いにしてしまう。
 */
export function isConnectivityFailure(failure: AuthFailure): boolean {
  if (!failure) return false

  // Supabase は到達できないとき status 0 の再試行可能エラーを返す
  if (failure.status === 0) return true
  if (failure.name === 'AuthRetryableFetchError') return true

  const message = failure.message ?? ''
  return /failed to fetch|networkerror|fetch failed|network request failed/i.test(message)
}

/** 保護ルートに対して取るべき動作 */
export type ProtectedRouteAction = 'allow' | 'login' | 'offline'

/**
 * 保護ルートへのアクセスをどう扱うか決める。
 *
 * 認証サービスに到達できなかった場合は、ログイン画面へ送ってはいけない。
 * ログイン画面でも同じ理由でログインできず、利用者は行き止まりになる。
 * 「オフラインです」と伝える方が状況を正しく表している。
 */
export function decideProtectedRouteAction(input: {
  hasUser: boolean
  connectivityFailed: boolean
  isProtected: boolean
}): ProtectedRouteAction {
  if (!input.isProtected) return 'allow'
  if (input.hasUser) return 'allow'
  if (input.connectivityFailed) return 'offline'
  return 'login'
}

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

  // 到達できなかった場合を最初に分ける。
  // 資格情報の誤りと取り違えると、原因に辿り着けない
  if (isConnectivityFailure(failure)) {
    return {
      code: 'NETWORK_ERROR',
      message:
        '認証サービスに接続できませんでした。インターネット接続をご確認ください。',
    }
  }

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
