import type { SupabaseClient } from '@supabase/supabase-js'
import type { EstimateSource } from '@/lib/domain/estimate-days'
import type { TaskPriority, TaskStatus } from '@/lib/domain/tasks'

export type Task = {
  id: string
  projectId: string
  sourceFileId: string | null
  sourceVersion: number | null
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string
  /** 名簿のメンバー。選ばれていなければ null */
  assigneeMemberId: string | null
  /** 表示用のメンバー名。参照が切れていれば null */
  assigneeMemberName: string | null
  /** 想定日程（日）。0.5 刻み。未設定は null */
  estimatedDays: number | null
  /** 想定日程の出どころ。空は手入力または未設定 */
  estimateSource: EstimateSource | ''
  dueDate: string | null
  ambiguityNote: string
  aiSuggestion: string
  origin: 'ai' | 'manual'
  position: number
  updatedAt: string
}

export type TaskInput = {
  /** 名簿からの担当。AI 抽出では決まらないため null */
  assigneeMemberId?: string | null
  estimatedDays?: number | null
  estimateSource?: EstimateSource | ''
  projectId: string
  sourceFileId: string | null
  sourceVersion: number | null
  title: string
  description: string
  priority: TaskPriority
  assignee: string
  dueDate: string | null
  ambiguityNote: string
  aiSuggestion: string
  origin: 'ai' | 'manual'
  createdBy: string
}

export type TaskPatch = Partial<{
  /** null を渡すと、名簿からの担当を外す */
  assigneeMemberId: string | null
  estimatedDays: number | null
  estimateSource: EstimateSource | ''
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string
  dueDate: string | null
  position: number
}>

export interface TaskRepository {
  listByProject(projectId: string): Promise<Task[]>
  createMany(inputs: TaskInput[]): Promise<number>
  update(id: string, patch: TaskPatch): Promise<void>
  remove(id: string): Promise<void>
  /** まとめて消す。1 件ずつ往復すると、件数だけ待たされる */
  removeMany(ids: string[]): Promise<number>
}

type Row = {
  id: string
  project_id: string
  source_file_id: string | null
  source_version: number | null
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string
  assignee_member_id: string | null
  estimated_days: number | string | null
  estimate_source: EstimateSource | ''
  /** 結合結果。PostgREST は配列で返す */
  project_members: { name: string }[] | { name: string } | null
  due_date: string | null
  ambiguity_note: string
  ai_suggestion: string
  origin: 'ai' | 'manual'
  position: number
  updated_at: string
}

const COLUMNS =
  'id, project_id, source_file_id, source_version, title, description, status, priority, assignee, assignee_member_id, estimated_days, estimate_source, project_members(name), due_date, ambiguity_note, ai_suggestion, origin, position, updated_at'

/** 結合結果から名前を取り出す。配列でも単体でも受ける */
function memberNameOf(
  joined: { name: string }[] | { name: string } | null,
): string | null {
  if (!joined) return null
  if (Array.isArray(joined)) return joined[0]?.name ?? null
  return joined.name
}

function toTask(row: Row): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceFileId: row.source_file_id,
    sourceVersion: row.source_version,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    assigneeMemberId: row.assignee_member_id,
    assigneeMemberName: memberNameOf(row.project_members),
    // numeric は文字列で返ることがある
    estimatedDays: row.estimated_days === null ? null : Number(row.estimated_days),
    estimateSource: row.estimate_source,
    dueDate: row.due_date,
    ambiguityNote: row.ambiguity_note,
    aiSuggestion: row.ai_suggestion,
    origin: row.origin,
    position: row.position,
    updatedAt: row.updated_at,
  }
}

/**
 * タスク。
 *
 * 行レベルセキュリティにより、自分のデータだけが見える。
 */
export function createSupabaseTaskRepository(supabase: SupabaseClient): TaskRepository {
  return {
    async listByProject(projectId) {
      const { data, error } = await supabase
        .from('tasks')
        .select(COLUMNS)
        .eq('project_id', projectId)
        .order('position')
        .order('updated_at', { ascending: false })
      if (error) throw error
      // 結合した project_members は配列で返るため、いったん unknown を挟む
      return (data as unknown as Row[]).map(toTask)
    },

    async createMany(inputs) {
      if (inputs.length === 0) return 0
      const { error, count } = await supabase.from('tasks').insert(
        inputs.map((input, index) => ({
          project_id: input.projectId,
          source_file_id: input.sourceFileId,
          source_version: input.sourceVersion,
          title: input.title,
          description: input.description,
          priority: input.priority,
          assignee: input.assignee,
          assignee_member_id: input.assigneeMemberId ?? null,
          estimated_days: input.estimatedDays ?? null,
          estimate_source: input.estimateSource ?? '',
          due_date: input.dueDate,
          ambiguity_note: input.ambiguityNote,
          ai_suggestion: input.aiSuggestion,
          origin: input.origin,
          position: index,
          created_by: input.createdBy,
        })),
        { count: 'exact' },
      )
      if (error) throw error
      return count ?? inputs.length
    },

    async update(id, patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.title !== undefined) row.title = patch.title
      if (patch.description !== undefined) row.description = patch.description
      if (patch.status !== undefined) row.status = patch.status
      if (patch.priority !== undefined) row.priority = patch.priority
      if (patch.assignee !== undefined) row.assignee = patch.assignee
      if (patch.assigneeMemberId !== undefined) {
        row.assignee_member_id = patch.assigneeMemberId
      }
      if (patch.estimatedDays !== undefined) row.estimated_days = patch.estimatedDays
      if (patch.estimateSource !== undefined) row.estimate_source = patch.estimateSource
      if (patch.dueDate !== undefined) row.due_date = patch.dueDate
      if (patch.position !== undefined) row.position = patch.position

      const { error } = await supabase.from('tasks').update(row).eq('id', id)
      if (error) throw error
    },

    async remove(id) {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },

    async removeMany(ids) {
      if (ids.length === 0) return 0

      // 消せた件数を返す。行レベルセキュリティにより、
      // 他人のタスクを混ぜても消えない（件数の差で気付ける）
      const { data, error } = await supabase
        .from('tasks')
        .delete()
        .in('id', ids)
        .select('id')
      if (error) throw error

      return (data ?? []).length
    },
  }
}
