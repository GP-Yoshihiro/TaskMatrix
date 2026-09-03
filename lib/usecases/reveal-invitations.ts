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
