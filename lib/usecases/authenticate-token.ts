import { hashToken, nextRateState, parseBearer } from '@/lib/domain/api-token'
import type { AppError } from '@/lib/domain/result'
import type { ApiTokenRepository } from '@/lib/repositories/api-tokens'

export type TokenAuth = {
  tokenId: string
  projectId: string
  userId: string
}

export type AuthResult =
  | { ok: true; data: TokenAuth }
  | { ok: false; error: AppError; retryAfterSeconds: number }

/**
 * 認証失敗はすべてこの 1 つで返す。
 *
 * 「そのトークンは存在するが形式が違う」といった書き分けをすると、
 * 有効なトークンの探索を助けてしまう。トークン自体もメッセージに含めない。
 */
const UNAUTHORIZED: AppError = {
  code: 'UNAUTHENTICATED',
  message: '認証できませんでした。',
}

const deny = (error: AppError, retryAfterSeconds = 0): AuthResult => ({
  ok: false,
  error,
  retryAfterSeconds,
})

/**
 * 連携トークンを検証し、操作できる範囲を返す。
 *
 * 返す projectId が唯一の操作範囲になる。
 * 呼び出し側はリクエスト本文からプロジェクトを受け取ってはならない。
 */
export async function authenticateToken(
  repository: ApiTokenRepository,
  authorization: string | null,
  now: Date,
): Promise<AuthResult> {
  const token = parseBearer(authorization)
  if (!token) return deny(UNAUTHORIZED)

  const row = await repository.findByHash(hashToken(token))
  if (!row) return deny(UNAUTHORIZED)

  const rate = nextRateState(
    { windowStartedAt: row.rateWindowStartedAt, count: row.rateCount },
    now,
  )

  if (!rate.allowed) {
    return deny(
      {
        code: 'RATE_LIMITED',
        message: 'リクエストが多すぎます。少し待ってからお試しください。',
      },
      rate.retryAfterSeconds,
    )
  }

  try {
    await repository.touch(row.id, {
      lastUsedAt: now.toISOString(),
      rateWindowStartedAt: rate.windowStartedAt,
      rateCount: rate.count,
    })
  } catch {
    // 記録は付随的な機能。これで API が使えなくなるのは本末転倒なので通す
  }

  return {
    ok: true,
    data: { tokenId: row.id, projectId: row.projectId, userId: row.userId },
  }
}
