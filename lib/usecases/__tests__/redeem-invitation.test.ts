import { describe, expect, it, vi } from 'vitest'
import { hashCode } from '@/lib/domain/invitation'
import { err, ok } from '@/lib/domain/result'
import type { AccountCreator, InvitationClaimRepository } from '../redeem-invitation'
import { redeemInvitation } from '../redeem-invitation'

type ClaimFn = InvitationClaimRepository['claim']

const CODE = 'inv_AbCdEf'
const NOW = new Date('2026-09-03T00:00:00.000Z')

function setup(
  overrides: {
    claim?: ReturnType<typeof vi.fn<ClaimFn>>
    createAccount?: ReturnType<typeof vi.fn<AccountCreator>>
  } = {},
) {
  const claim =
    overrides.claim ?? vi.fn<ClaimFn>().mockResolvedValue({ id: 'invite-1' })
  const release = vi.fn<InvitationClaimRepository['release']>().mockResolvedValue(undefined)
  const markUsedBy = vi
    .fn<InvitationClaimRepository['markUsedBy']>()
    .mockResolvedValue(undefined)
  const createAccount =
    overrides.createAccount ??
    vi.fn<AccountCreator>().mockResolvedValue(ok({ userId: 'user-1' }))

  return {
    deps: {
      repo: { claim, release, markUsedBy },
      createAccount,
      now: NOW,
    },
    claim,
    release,
    markUsedBy,
    createAccount,
  }
}

const input = { code: CODE, email: 'a@example.com', password: 'password123' }

describe('redeemInvitation', () => {
  it('有効なコードならアカウントを作る', async () => {
    const { deps, createAccount } = setup()

    const result = await redeemInvitation(deps, input)

    expect(result.ok).toBe(true)
    expect(createAccount).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'password123',
    })
  })

  it('平文ではなくハッシュで確保する', async () => {
    // 平文を問い合わせに乗せると、ログに残りうる
    const { deps, claim } = setup()

    await redeemInvitation(deps, input)

    expect(claim).toHaveBeenCalledWith(hashCode(CODE), NOW.toISOString())
  })

  it('前後の空白が付いていても通す', async () => {
    // メールから貼ると空白が付いてくる
    const { deps, claim } = setup()

    await redeemInvitation(deps, { ...input, code: `  ${CODE}\n` })

    expect(claim).toHaveBeenCalledWith(hashCode(CODE), NOW.toISOString())
  })

  it('確保できなければアカウントを作らない', async () => {
    const { deps, createAccount } = setup({ claim: vi.fn<ClaimFn>().mockResolvedValue(null) })

    const result = await redeemInvitation(deps, input)

    expect(result.ok).toBe(false)
    expect(createAccount).not.toHaveBeenCalled()
  })

  it('確保できなかった理由を、コードの状態まで明かさずに伝える', async () => {
    // 「使用済み」と「存在しない」を区別して返すと、総当たりの手掛かりになる
    const { deps } = setup({ claim: vi.fn<ClaimFn>().mockResolvedValue(null) })

    const result = await redeemInvitation(deps, input)

    if (result.ok) throw new Error('失敗するはず')
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message).toContain('招待コード')
  })

  it('アカウント作成に失敗したら確保を戻す', async () => {
    // 戻さないと、使われていないコードが二度と使えなくなる
    const { deps, release } = setup({
      createAccount: vi
        .fn<AccountCreator>()
        .mockResolvedValue(err('UNKNOWN', '作れませんでした。')),
    })

    await redeemInvitation(deps, input)

    expect(release).toHaveBeenCalledWith('invite-1')
  })

  it('アカウント作成の失敗は、その内容のまま返す', async () => {
    const { deps } = setup({
      createAccount: vi
        .fn<AccountCreator>()
        .mockResolvedValue(err('VALIDATION_ERROR', 'このメールアドレスは既に登録されています。')),
    })

    const result = await redeemInvitation(deps, input)

    if (result.ok) throw new Error('失敗するはず')
    expect(result.error.message).toContain('既に登録されています')
  })

  it('作成に成功したら、誰が使ったかを記録する', async () => {
    const { deps, markUsedBy } = setup()

    await redeemInvitation(deps, input)

    expect(markUsedBy).toHaveBeenCalledWith('invite-1', 'user-1')
  })

  it('作成に失敗したときは使用者を記録しない', async () => {
    const { deps, markUsedBy } = setup({
      createAccount: vi
        .fn<AccountCreator>()
        .mockResolvedValue(err('UNKNOWN', '作れませんでした。')),
    })

    await redeemInvitation(deps, input)

    expect(markUsedBy).not.toHaveBeenCalled()
  })
})
