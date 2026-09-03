import type { SupabaseClient } from '@supabase/supabase-js'
import type { InvitationClaimRepository } from '@/lib/usecases/redeem-invitation'

export type Invitation = {
  id: string
  displayPrefix: string
  /** 暗号化した本体。管理者が読み返すためだけに持つ */
  codeEncrypted: string
  note: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
  revokedAt: string | null
}

export interface InvitationRepository extends InvitationClaimRepository {
  create(input: {
    codeHash: string
    codeEncrypted: string
    displayPrefix: string
    note: string
    createdBy: string
    expiresAt: string
  }): Promise<Invitation>
  listByCreator(createdBy: string): Promise<Invitation[]>
  revoke(id: string, revokedAt: string): Promise<void>
}

type Row = {
  id: string
  display_prefix: string
  code_encrypted: string
  note: string
  created_at: string
  expires_at: string
  used_at: string | null
  revoked_at: string | null
}

const COLUMNS =
  'id, display_prefix, code_encrypted, note, created_at, expires_at, used_at, revoked_at'

function toInvitation(row: Row): Invitation {
  return {
    id: row.id,
    displayPrefix: row.display_prefix,
    codeEncrypted: row.code_encrypted,
    note: row.note,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
  }
}

/**
 * 招待コード。ハッシュのみを保存し、平文は持たない。
 *
 * 発行と一覧は行レベルセキュリティ下（管理者のみ）で呼ぶ。
 * `claim` / `release` / `markUsedBy` は登録前で、まだセッションが無いため
 * サーバー専用キーのクライアントで呼ぶ。
 */
export function createSupabaseInvitationRepository(
  supabase: SupabaseClient,
): InvitationRepository {
  return {
    async create(input) {
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          code_hash: input.codeHash,
          code_encrypted: input.codeEncrypted,
          display_prefix: input.displayPrefix,
          note: input.note,
          created_by: input.createdBy,
          expires_at: input.expiresAt,
        })
        .select(COLUMNS)
        .single()
      if (error) throw error

      return toInvitation(data as Row)
    },

    async listByCreator(createdBy) {
      const { data, error } = await supabase
        .from('invitations')
        .select(COLUMNS)
        .eq('created_by', createdBy)
        .order('created_at', { ascending: false })
      if (error) throw error

      return ((data ?? []) as Row[]).map(toInvitation)
    },

    async revoke(id, revokedAt) {
      // 使用済みのものは触らない。使った記録を消してしまわないため
      const { error } = await supabase
        .from('invitations')
        .update({ revoked_at: revokedAt })
        .eq('id', id)
        .is('used_at', null)
      if (error) throw error
    },

    /**
     * 未使用のものを原子的に確保する。
     *
     * 照合と使用済み化を **1 文で**行う。分けると、その隙間に
     * 同じコードで二重に通る。条件に合う行が無ければ 0 行が返る。
     */
    async claim(codeHash, now) {
      const { data, error } = await supabase
        .from('invitations')
        .update({ used_at: now })
        .eq('code_hash', codeHash)
        .is('used_at', null)
        .is('revoked_at', null)
        .gt('expires_at', now)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) return null

      return { id: (data as { id: string }).id }
    },

    async release(id) {
      const { error } = await supabase
        .from('invitations')
        .update({ used_at: null })
        .eq('id', id)
      if (error) throw error
    },

    async markUsedBy(id, userId) {
      const { error } = await supabase
        .from('invitations')
        .update({ used_by: userId })
        .eq('id', id)
      if (error) throw error
    },
  }
}
