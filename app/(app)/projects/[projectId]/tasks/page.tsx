import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { TaskManager } from '@/components/app/task-manager'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function TasksPage({
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

  const tasks = await createSupabaseTaskRepository(supabase).listByProject(projectId)

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageHeader
        projectId={projectId}
        projectName={project.name}
        pageLabel="タスク"
        title="タスク"
        description="AI が抽出したタスクと、手で追加したタスクの一覧です。"
      />
      <TaskManager projectId={projectId} tasks={tasks} />
    </div>
  )
}
