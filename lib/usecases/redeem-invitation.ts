import { hashCode, normalizeCode } from '@/lib/domain/invitation'
import { type Result, err, ok } from '@/lib/domain/result'

/**
 * 招待コードを使ってアカウントを作る。
 *
 * 順序に意味がある。**先に確保してから作る。**
 * 先に照合してから作る順だと、その隙間に同じコードで二重に通る。
 * 作成に失敗したら確保を戻し、使われていないコードを潰さない。
 */

/** 確保と記録に必要な操作だけを求める。表の詳細はここでは扱わない */
export interface InvitationClaimRepository {
  /** 未使用・未失効・期限内のものを原子的に確保する。取れなければ null */
  claim(codeHash: string, now: string): Promise<{ id: string } | null>
  /** 確保を戻す */
  release(id: string): Promise<void>
  /** 誰が使ったかを記録する */
  markUsedBy(id: string, userId: string): Promise<void>
}

export type AccountCreator = (input: {
  email: string
  password: string
}) => Promise<Result<{ userId: string }>>

export async function redeemInvitation(
  deps: {
    repo: InvitationClaimRepository
    createAccount: AccountCreator
    now: Date
  },
  input: { code: string; email: string; password: string },
): Promise<Result<{ userId: string }>> {
  // 平文は問い合わせに乗せない。ログに残りうるため
  const codeHash = hashCode(normalizeCode(input.code))

  const claimed = await deps.repo.claim(codeHash, deps.now.toISOString())
  if (!claimed) {
    // 「使用済み」と「存在しない」を区別して返すと、総当たりの手掛かりになる
    return err(
      'VALIDATION_ERROR',
      '招待コードが正しくないか、すでに使われています。発行元にご確認ください。',
    )
  }

  const created = await deps.createAccount({
    email: input.email,
    password: input.password,
  })

  if (!created.ok) {
    // 戻さないと、使われていないコードが二度と使えなくなる
    await deps.repo.release(claimed.id)
    return created
  }

  await deps.repo.markUsedBy(claimed.id, created.data.userId)

  return ok(created.data)
}
