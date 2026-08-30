import type { SupabaseClient } from '@supabase/supabase-js'
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
  dueDate: string | null
  ambiguityNote: string
  aiSuggestion: string
  origin: 'ai' | 'manual'
  position: number
  updatedAt: string
}

export type TaskInput = {
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
  due_date: string | null
  ambiguity_note: string
  ai_suggestion: string
  origin: 'ai' | 'manual'
  position: number
  updated_at: string
}

const COLUMNS =
  'id, project_id, source_file_id, source_version, title, description, status, priority, assignee, due_date, ambiguity_note, ai_suggestion, origin, position, updated_at'

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
    dueDate: row.due_date,
    ambiguityNote: row.ambiguity_note,
    aiSuggestion: row.ai_suggestion,
    origin: row.origin,
    position: row.position,
    updatedAt: row.updated_at,
  }
}

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
      return (data as Row[]).map(toTask)
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
      if (patch.dueDate !== undefined) row.due_date = patch.dueDate
      if (patch.position !== undefined) row.position = patch.position

      const { error } = await supabase.from('tasks').update(row).eq('id', id)
      if (error) throw error
    },

    async remove(id) {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
  }
}
