import type { SupabaseClient } from '@supabase/supabase-js'

export type ChunkInput = {
  projectId: string
  fileId: string
  fileVersion: number
  chunkIndex: number
  content: string
}

export type MatchedChunk = {
  id: string
  fileId: string
  chunkIndex: number
  content: string
  similarity: number
}

export interface FileChunkRepository {
  /** そのファイルのチャンクを版に関わらずすべて消す（古い版を残さない） */
  deleteByFile(fileId: string): Promise<void>
  insertMany(inputs: ChunkInput[]): Promise<{ id: string }[]>
  updateEmbedding(id: string, embedding: number[]): Promise<void>
  countByProject(projectId: string): Promise<number>
  search(input: {
    projectId: string
    embedding: number[]
    limit: number
  }): Promise<MatchedChunk[]>
}

/**
 * 検索用に分割した本文と、その埋め込み。
 *
 * 行レベルセキュリティにより、自分のデータだけが見える。
 */
export function createSupabaseFileChunkRepository(
  supabase: SupabaseClient,
): FileChunkRepository {
  return {
    async deleteByFile(fileId) {
      const { error } = await supabase.from('file_chunks').delete().eq('file_id', fileId)
      if (error) throw error
    },

    async insertMany(inputs) {
      if (inputs.length === 0) return []
      const { data, error } = await supabase
        .from('file_chunks')
        .insert(
          inputs.map((input) => ({
            project_id: input.projectId,
            file_id: input.fileId,
            file_version: input.fileVersion,
            chunk_index: input.chunkIndex,
            content: input.content,
          })),
        )
        .select('id')
      if (error) throw error
      return (data as { id: string }[]) ?? []
    },

    async updateEmbedding(id, embedding) {
      const { error } = await supabase
        .from('file_chunks')
        // pgvector は文字列表現でも受け取れる
        .update({ embedding: JSON.stringify(embedding) })
        .eq('id', id)
      if (error) throw error
    },

    async countByProject(projectId) {
      const { count, error } = await supabase
        .from('file_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .not('embedding', 'is', null)
      if (error) throw error
      return count ?? 0
    },

    async search({ projectId, embedding, limit }) {
      const { data, error } = await supabase.rpc('match_file_chunks', {
        target_project_id: projectId,
        query_embedding: JSON.stringify(embedding),
        match_count: limit,
      })
      if (error) throw error

      type Row = {
        id: string
        file_id: string
        chunk_index: number
        content: string
        similarity: number
      }

      return ((data ?? []) as Row[]).map((row) => ({
        id: row.id,
        fileId: row.file_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        similarity: row.similarity,
      }))
    },
  }
}
