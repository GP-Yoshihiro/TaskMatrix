import type { SupabaseClient } from '@supabase/supabase-js'
import type { FileKind } from '@/lib/domain/files'

export type ProjectFile = {
  id: string
  projectId: string
  folderId: string | null
  name: string
  kind: FileKind
  mimeType: string
  size: number
  storagePath: string | null
  currentVersion: number
  updatedAt: string
}

export interface FileRepository {
  listByProject(projectId: string): Promise<ProjectFile[]>
  findById(id: string): Promise<ProjectFile | null>
  create(input: {
    projectId: string
    folderId: string | null
    name: string
    kind: FileKind
    mimeType: string
    size: number
    storagePath: string | null
    createdBy: string
  }): Promise<ProjectFile>
  updateForNewVersion(input: {
    id: string
    version: number
    size: number
    storagePath: string | null
  }): Promise<void>
  remove(id: string): Promise<void>
}

type Row = {
  id: string
  project_id: string
  folder_id: string | null
  name: string
  kind: FileKind
  mime_type: string
  size: number
  storage_path: string | null
  current_version: number
  updated_at: string
}

const COLUMNS =
  'id, project_id, folder_id, name, kind, mime_type, size, storage_path, current_version, updated_at'

function toFile(row: Row): ProjectFile {
  return {
    id: row.id,
    projectId: row.project_id,
    folderId: row.folder_id,
    name: row.name,
    kind: row.kind,
    mimeType: row.mime_type,
    size: row.size,
    storagePath: row.storage_path,
    currentVersion: row.current_version,
    updatedAt: row.updated_at,
  }
}

/**
 * プロジェクト内のファイル。
 *
 * 行レベルセキュリティにより、自分のデータだけが見える。
 */
export function createSupabaseFileRepository(supabase: SupabaseClient): FileRepository {
  return {
    async listByProject(projectId) {
      const { data, error } = await supabase
        .from('files')
        .select(COLUMNS)
        .eq('project_id', projectId)
        .order('name')
      if (error) throw error
      return (data as Row[]).map(toFile)
    },

    async findById(id) {
      const { data, error } = await supabase
        .from('files')
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data ? toFile(data as Row) : null
    },

    async create(input) {
      const { data, error } = await supabase
        .from('files')
        .insert({
          project_id: input.projectId,
          folder_id: input.folderId,
          name: input.name,
          kind: input.kind,
          mime_type: input.mimeType,
          size: input.size,
          storage_path: input.storagePath,
          created_by: input.createdBy,
        })
        .select(COLUMNS)
        .single()
      if (error) throw error
      return toFile(data as Row)
    },

    async updateForNewVersion({ id, version, size, storagePath }) {
      const { error } = await supabase
        .from('files')
        .update({
          current_version: version,
          size,
          storage_path: storagePath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },

    async remove(id) {
      const { error } = await supabase.from('files').delete().eq('id', id)
      if (error) throw error
    },
  }
}
