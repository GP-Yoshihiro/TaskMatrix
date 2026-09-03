import { decryptSecret } from '@/lib/domain/crypto'
import type { Invitation } from '@/lib/repositories/invitations'

/**
 * 招待コードを、管理者に見せられる形に戻す。
 *
 * 照合には使わない。照合は復号を伴わないハッシュで行う。
 * ここでの復号は「渡したコードを読み返す」ためだけのもの。
 *
 * 1 件でも復号に失敗したときに画面全体が出なくなると困るため、
 * 失敗は例外にせず、その行の code を null にして残りを返す。
 */
export type RevealedInvitation = Omit<Invitation, 'codeEncrypted'> & {
  /** 復号できたコード。読み返せないものは null */
  code: string | null
}

/** 施錠中の画面に渡す情報。コードそのものは含めない */
export type InvitationSummary = Omit<Invitation, 'codeEncrypted'>

/**
 * 暗号文を落として、伏せたまま並べられる形にする。
 *
 * 残す項目を明示的に並べている。除外する形で書くと、
 * あとで表に列が増えたとき、気付かないまま画面へ流れてしまう。
 */
export function toSummaries(invitations: Invitation[]): InvitationSummary[] {
  return invitations.map((invitation) => ({
    id: invitation.id,
    displayPrefix: invitation.displayPrefix,
    note: invitation.note,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    usedAt: invitation.usedAt,
    revokedAt: invitation.revokedAt,
  }))
}

export function revealInvitations(
  invitations: Invitation[],
  keyBase64: string | undefined,
): RevealedInvitation[] {
  return invitations.map(({ codeEncrypted, ...rest }) => ({
    ...rest,
    code: reveal(codeEncrypted, keyBase64),
  }))
}

function reveal(codeEncrypted: string, keyBase64: string | undefined): string | null {
  // 鍵が無い、またはこの機能より前に発行されたもの
  if (!keyBase64 || codeEncrypted === '') return null

  try {
    return decryptSecret(codeEncrypted, keyBase64)
  } catch {
    // 鍵の長さが不正なときはここに来る。画面は出し続ける
    return null
  }
}
