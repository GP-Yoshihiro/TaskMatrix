import type { SupabaseClient } from '@supabase/supabase-js'

export type ApiToken = {
  id: string
  name: string
  displayPrefix: string
  lastUsedAt: string | null
  createdAt: string
}

/** 認証時に必要な情報。平文のトークンは含まない */
export type TokenAuthRow = {
  id: string
  projectId: string
  userId: string
  rateWindowStartedAt: string | null
  rateCount: number
}

export interface ApiTokenRepository {
  create(input: {
    projectId: string
    userId: string
    name: string
    tokenHash: string
    displayPrefix: string
  }): Promise<ApiToken>
  listByProject(projectId: string): Promise<ApiToken[]>
  deleteById(id: string): Promise<void>
  findByHash(tokenHash: string): Promise<TokenAuthRow | null>
  touch(
    id: string,
    input: { lastUsedAt: string; rateWindowStartedAt: string; rateCount: number },
  ): Promise<void>
}

type Row = {
  id: string
  name: string
  display_prefix: string
  last_used_at: string | null
  created_at: string
}

const COLUMNS = 'id, name, display_prefix, last_used_at, created_at'

function toToken(row: Row): ApiToken {
  return {
    id: row.id,
    name: row.name,
    displayPrefix: row.display_prefix,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  }
}

/**
 * 連携トークン。ハッシュのみを保存し、平文は持たない。
 *
 * 行レベルセキュリティにより、自分のデータだけが見える。
 */
export function createSupabaseApiTokenRepository(
  supabase: SupabaseClient,
): ApiTokenRepository {
  return {
    async create(input) {
      const { data, error } = await supabase
        .from('api_tokens')
        .insert({
          project_id: input.projectId,
          user_id: input.userId,
          name: input.name,
          token_hash: input.tokenHash,
          display_prefix: input.displayPrefix,
        })
        .select(COLUMNS)
        .single()
      if (error) throw error

      return toToken(data as Row)
    },

    async listByProject(projectId) {
      const { data, error } = await supabase
        .from('api_tokens')
        .select(COLUMNS)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) throw error

      return ((data ?? []) as Row[]).map(toToken)
    },

    async deleteById(id) {
      const { error } = await supabase.from('api_tokens').delete().eq('id', id)
      if (error) throw error
    },

    /** ハッシュの等値検索。索引が効く 1 回の問い合わせで済む */
    async findByHash(tokenHash) {
      const { data, error } = await supabase
        .from('api_tokens')
        .select('id, project_id, user_id, rate_window_started_at, rate_count')
        .eq('token_hash', tokenHash)
        .maybeSingle()
      if (error) throw error
      if (!data) return null

      const row = data as {
        id: string
        project_id: string
        user_id: string
        rate_window_started_at: string | null
        rate_count: number
      }

      return {
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        rateWindowStartedAt: row.rate_window_started_at,
        rateCount: row.rate_count,
      }
    },

    async touch(id, input) {
      const { error } = await supabase
        .from('api_tokens')
        .update({
          last_used_at: input.lastUsedAt,
          rate_window_started_at: input.rateWindowStartedAt,
          rate_count: input.rateCount,
        })
        .eq('id', id)
      if (error) throw error
    },
  }
}
