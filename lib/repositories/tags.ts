import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tag } from '@/lib/domain/tag'

export interface TagRepository {
  listByProject(projectId: string): Promise<Tag[]>
  listByFile(fileId: string): Promise<Tag[]>
  /** 同名があれば作らずに返す。表記ゆれでタグが増えないようにする */
  findOrCreate(input: { projectId: string; name: string; locked: boolean }): Promise<Tag>
  attach(fileId: string, tagId: string): Promise<void>
  detach(fileId: string, tagId: string): Promise<void>
  /** ロック付きのタグが付いたファイル。削除の可否と容量削減で使う */
  listLockedFileIds(projectId: string): Promise<string[]>
}

type TagRow = { id: string; name: string; locked: boolean }

/**
 * タグと、その付与。ロック付きはファイルの削除を防ぐ。
 *
 * 行レベルセキュリティにより、自分のデータだけが見える。
 */
export function createSupabaseTagRepository(supabase: SupabaseClient): TagRepository {
  return {
    async listByProject(projectId) {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, locked')
        .eq('project_id', projectId)
        .order('name')
      if (error) throw error

      return (data ?? []) as TagRow[]
    },

    async listByFile(fileId) {
      const { data, error } = await supabase
        .from('file_tags')
        .select('tags(id, name, locked)')
        .eq('file_id', fileId)
      if (error) throw error

      return ((data ?? []) as unknown as { tags: TagRow | null }[])
        .map((row) => row.tags)
        .filter((tag): tag is TagRow => tag !== null)
    },

    async findOrCreate({ projectId, name, locked }) {
      const existing = await supabase
        .from('tags')
        .select('id, name, locked')
        .eq('project_id', projectId)
        .eq('name', name)
        .maybeSingle()
      if (existing.error) throw existing.error
      if (existing.data) return existing.data as TagRow

      const created = await supabase
        .from('tags')
        .insert({ project_id: projectId, name, locked })
        .select('id, name, locked')
        .single()
      if (created.error) throw created.error

      return created.data as TagRow
    },

    async attach(fileId, tagId) {
      // 同じ組み合わせを二度付けても失敗させない
      const { error } = await supabase
        .from('file_tags')
        .upsert({ file_id: fileId, tag_id: tagId }, { onConflict: 'file_id,tag_id' })
      if (error) throw error
    },

    async detach(fileId, tagId) {
      const { error } = await supabase
        .from('file_tags')
        .delete()
        .eq('file_id', fileId)
        .eq('tag_id', tagId)
      if (error) throw error
    },

    async listLockedFileIds(projectId) {
      const { data, error } = await supabase
        .from('file_tags')
        .select('file_id, tags!inner(project_id, locked)')
        .eq('tags.project_id', projectId)
        .eq('tags.locked', true)
      if (error) throw error

      const ids = ((data ?? []) as { file_id: string }[]).map((row) => row.file_id)
      return [...new Set(ids)]
    },
  }
}
