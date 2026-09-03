import type { SupabaseClient } from '@supabase/supabase-js'

export type Project = {
  id: string
  ownerId: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

/** プロジェクトのデータアクセス。実装を差し替えられるようインターフェースを切る */
export interface ProjectRepository {
  listByOwner(ownerId: string): Promise<Project[]>
  countByOwner(ownerId: string): Promise<number>
  create(input: { ownerId: string; name: string }): Promise<Project>
  rename(id: string, name: string): Promise<void>
  remove(id: string): Promise<void>
}

type Row = {
  id: string
  owner_id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

function toProject(row: Row): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * プロジェクト。
 *
 * 行レベルセキュリティにより、自分のデータだけが見える。
 */
export function createSupabaseProjectRepository(
  supabase: SupabaseClient,
): ProjectRepository {
  return {
    async listByOwner(ownerId) {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', ownerId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data as Row[]).map(toProject)
    },

    async countByOwner(ownerId) {
      const { count, error } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
      if (error) throw error
      return count ?? 0
    },

    async create({ ownerId, name }) {
      const { data, error } = await supabase
        .from('projects')
        .insert({ owner_id: ownerId, name })
        .select('*')
        .single()
      if (error) throw error
      return toProject(data as Row)
    },

    async rename(id, name) {
      const { error } = await supabase
        .from('projects')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },

    async remove(id) {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
  }
}
