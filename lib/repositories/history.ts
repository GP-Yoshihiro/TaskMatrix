import type { SupabaseClient } from '@supabase/supabase-js'
import type { Change, HistoryAction } from '@/lib/domain/history'
import { resolveAuthorName } from '@/lib/domain/profile'

export type HistoryEntry = {
  id: string
  fileId: string | null
  fileName: string
  fileExtension: string
  fileKind: string
  action: HistoryAction
  version: number | null
  addedCount: number
  removedCount: number
  truncated: boolean
  /** 表示名・メール・記録時の名前から決めた最終的な名前 */
  authorName: string
  createdAt: string
}

export type RecordHistoryInput = {
  projectId: string
  fileId: string | null
  fileName: string
  fileExtension: string
  fileKind: string
  action: HistoryAction
  version: number | null
  changes: Change[]
  addedCount: number
  removedCount: number
  truncated: boolean
  authorId: string | null
  authorName: string
}

export type ListHistoryInput = {
  projectId: string
  order: 'desc' | 'asc'
  limit: number
  /** 続きを読むための位置。前回の最後の created_at を渡す */
  cursor?: { createdAt: string; id: string }
}

export interface HistoryRepository {
  record(input: RecordHistoryInput): Promise<void>
  listByProject(input: ListHistoryInput): Promise<HistoryEntry[]>
  countByProject(projectId: string): Promise<number>
}

type Row = {
  id: string
  file_id: string | null
  file_name: string
  file_extension: string
  file_kind: string
  action: HistoryAction
  version: number | null
  added_count: number
  removed_count: number
  truncated: boolean
  author_name: string
  created_at: string
  profiles: { display_name: string | null; email: string | null } | null
}

const COLUMNS =
  'id, file_id, file_name, file_extension, file_kind, action, version, ' +
  'added_count, removed_count, truncated, author_name, created_at, ' +
  'profiles(display_name, email)'

function toEntry(row: Row): HistoryEntry {
  return {
    id: row.id,
    fileId: row.file_id,
    fileName: row.file_name,
    fileExtension: row.file_extension,
    fileKind: row.file_kind,
    action: row.action,
    version: row.version,
    addedCount: row.added_count,
    removedCount: row.removed_count,
    truncated: row.truncated,
    authorName: resolveAuthorName({
      displayName: row.profiles?.display_name ?? null,
      email: row.profiles?.email ?? null,
      snapshot: row.author_name,
    }),
    createdAt: row.created_at,
  }
}

export function createSupabaseHistoryRepository(
  supabase: SupabaseClient,
): HistoryRepository {
  return {
    async record(input) {
      const { error } = await supabase.from('history_entries').insert({
        project_id: input.projectId,
        file_id: input.fileId,
        file_name: input.fileName,
        file_extension: input.fileExtension,
        file_kind: input.fileKind,
        action: input.action,
        version: input.version,
        changes: input.changes,
        added_count: input.addedCount,
        removed_count: input.removedCount,
        truncated: input.truncated,
        author_id: input.authorId,
        author_name: input.authorName,
      })
      if (error) throw error
    },

    /**
     * 一定件数ずつ読む。
     * 同じ時刻の行が複数あっても取りこぼさないよう、id も並び順に含める。
     */
    async listByProject(input) {
      const ascending = input.order === 'asc'

      let query = supabase
        .from('history_entries')
        .select(COLUMNS)
        .eq('project_id', input.projectId)
        .order('created_at', { ascending })
        .order('id', { ascending })
        .limit(input.limit)

      if (input.cursor) {
        const operator = ascending ? 'gt' : 'lt'
        query = query.or(
          `created_at.${operator}.${input.cursor.createdAt},` +
            `and(created_at.eq.${input.cursor.createdAt},id.${operator}.${input.cursor.id})`,
        )
      }

      const { data, error } = await query
      if (error) throw error

      return ((data ?? []) as unknown as Row[]).map(toEntry)
    },

    async countByProject(projectId) {
      const { count, error } = await supabase
        .from('history_entries')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
      if (error) throw error

      return count ?? 0
    },
  }
}
