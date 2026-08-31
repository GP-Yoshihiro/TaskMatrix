import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskWeight } from '@/lib/domain/schedule'

export type Schedule = {
  id: string
  projectId: string
  taskId: string
  taskTitle: string
  startsAt: string
  endsAt: string
  reason: string
  weight: TaskWeight
}

export type ScheduleInput = {
  projectId: string
  taskId: string
  startsAt: string
  endsAt: string
  reason: string
  weight: TaskWeight
  createdBy: string
}

export interface ScheduleRepository {
  listByProject(projectId: string): Promise<Schedule[]>
  createMany(inputs: ScheduleInput[]): Promise<number>
  remove(id: string): Promise<void>
}

type Row = {
  id: string
  project_id: string
  task_id: string
  starts_at: string
  ends_at: string
  reason: string
  weight: TaskWeight
  tasks: { title: string } | null
}

const COLUMNS =
  'id, project_id, task_id, starts_at, ends_at, reason, weight, tasks(title)'

function toSchedule(row: Row): Schedule {
  return {
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    taskTitle: row.tasks?.title ?? '(削除されたタスク)',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
    weight: row.weight,
  }
}

export function createSupabaseScheduleRepository(
  supabase: SupabaseClient,
): ScheduleRepository {
  return {
    async listByProject(projectId) {
      const { data, error } = await supabase
        .from('schedules')
        .select(COLUMNS)
        .eq('project_id', projectId)
        .order('starts_at')
      if (error) throw error
      return (data as unknown as Row[]).map(toSchedule)
    },

    async createMany(inputs) {
      if (inputs.length === 0) return 0
      const { error, count } = await supabase.from('schedules').insert(
        inputs.map((input) => ({
          project_id: input.projectId,
          task_id: input.taskId,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          reason: input.reason,
          weight: input.weight,
          created_by: input.createdBy,
        })),
        { count: 'exact' },
      )
      if (error) throw error
      return count ?? inputs.length
    },

    async remove(id) {
      const { error } = await supabase.from('schedules').delete().eq('id', id)
      if (error) throw error
    },
  }
}
