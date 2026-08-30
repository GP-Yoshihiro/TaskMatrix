import type { SupabaseClient } from '@supabase/supabase-js'

export type FileVersion = {
  id: string
  fileId: string
  version: number
  content: string | null
  storagePath: string | null
  size: number
  authorId: string
  note: string
  createdAt: string
}

export interface FileVersionRepository {
  listByFile(fileId: string): Promise<FileVersion[]>
  findByVersion(fileId: string, version: number): Promise<FileVersion | null>
  create(input: {
    fileId: string
    version: number
    content: string | null
    storagePath: string | null
    size: number
    authorId: string
    note: string
  }): Promise<FileVersion>
}

type Row = {
  id: string
  file_id: string
  version: number
  content: string | null
  storage_path: string | null
  size: number
  author_id: string
  note: string
  created_at: string
}

const COLUMNS =
  'id, file_id, version, content, storage_path, size, author_id, note, created_at'

function toVersion(row: Row): FileVersion {
  return {
    id: row.id,
    fileId: row.file_id,
    version: row.version,
    content: row.content,
    storagePath: row.storage_path,
    size: row.size,
    authorId: row.author_id,
    note: row.note,
    createdAt: row.created_at,
  }
}

export function createSupabaseFileVersionRepository(
  supabase: SupabaseClient,
): FileVersionRepository {
  return {
    async listByFile(fileId) {
      const { data, error } = await supabase
        .from('file_versions')
        .select(COLUMNS)
        .eq('file_id', fileId)
        .order('version', { ascending: false })
      if (error) throw error
      return (data as Row[]).map(toVersion)
    },

    async findByVersion(fileId, version) {
      const { data, error } = await supabase
        .from('file_versions')
        .select(COLUMNS)
        .eq('file_id', fileId)
        .eq('version', version)
        .maybeSingle()
      if (error) throw error
      return data ? toVersion(data as Row) : null
    },

    async create(input) {
      const { data, error } = await supabase
        .from('file_versions')
        .insert({
          file_id: input.fileId,
          version: input.version,
          content: input.content,
          storage_path: input.storagePath,
          size: input.size,
          author_id: input.authorId,
          note: input.note,
        })
        .select(COLUMNS)
        .single()
      if (error) throw error
      return toVersion(data as Row)
    },
  }
}
