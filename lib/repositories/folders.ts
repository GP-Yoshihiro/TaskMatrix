import type { SupabaseClient } from '@supabase/supabase-js'
import type { FolderRow } from '@/lib/domain/folders'

export interface FolderRepository {
  listByProject(projectId: string): Promise<FolderRow[]>
  create(input: {
    projectId: string
    parentId: string | null
    name: string
  }): Promise<FolderRow>
  remove(id: string): Promise<void>
}

type Row = { id: string; name: string; parent_id: string | null }

/**
 * ファイルを整理するフォルダ（入れ子になる）。
 *
 * 行レベルセキュリティにより、自分のデータだけが見える。
 */
export function createSupabaseFolderRepository(
  supabase: SupabaseClient,
): FolderRepository {
  return {
    async listByProject(projectId) {
      const { data, error } = await supabase
        .from('folders')
        .select('id, name, parent_id')
        .eq('project_id', projectId)
      if (error) throw error
      return (data as Row[]).map((row) => ({
        id: row.id,
        name: row.name,
        parentId: row.parent_id,
      }))
    },

    async create({ projectId, parentId, name }) {
      const { data, error } = await supabase
        .from('folders')
        .insert({ project_id: projectId, parent_id: parentId, name })
        .select('id, name, parent_id')
        .single()
      if (error) throw error
      const row = data as Row
      return { id: row.id, name: row.name, parentId: row.parent_id }
    },

    async remove(id) {
      const { error } = await supabase.from('folders').delete().eq('id', id)
      if (error) throw error
    },
  }
}
