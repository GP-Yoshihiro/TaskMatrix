import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SchedulePlanner } from '@/components/app/schedule-planner'
import { DEFAULT_WORK_SETTINGS } from '@/lib/domain/schedule'
import { createSupabaseScheduleRepository } from '@/lib/repositories/schedules'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'
import { createSupabaseWorkSettingsRepository } from '@/lib/repositories/work-settings'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** AI の算出は 20 秒以上かかることがあるため、実行時間の上限を延ばす */
export const maxDuration = 120

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [tasks, confirmed, savedSettings] = await Promise.all([
    createSupabaseTaskRepository(supabase).listByProject(projectId),
    createSupabaseScheduleRepository(supabase).listByProject(projectId),
    user ? createSupabaseWorkSettingsRepository(supabase).find(user.id) : null,
  ])

  const settings = savedSettings ?? DEFAULT_WORK_SETTINGS

  const pendingTaskCount = tasks.filter((task) => task.status !== 'done').length

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{project.name} のスケジュール</h1>
        <Link href={`/projects/${projectId}/tasks`}>タスク一覧へ</Link>
        <Link href={`/projects/${projectId}`}>プロジェクトへ戻る</Link>
      </header>
      <SchedulePlanner
        projectId={projectId}
        confirmed={confirmed}
        pendingTaskCount={pendingTaskCount}
        settings={settings}
      />
    </div>
  )
}
