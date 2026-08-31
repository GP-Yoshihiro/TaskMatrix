import Link from 'next/link'
import { notFound } from 'next/navigation'
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
    <div style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{project.name} のタスク</h1>
        <Link href={`/projects/${projectId}/schedule`}>スケジュールへ</Link>
        <Link href={`/projects/${projectId}/chat`}>AI チャットへ</Link>
        <Link href={`/projects/${projectId}`}>プロジェクトへ戻る</Link>
      </header>
      <TaskManager projectId={projectId} tasks={tasks} />
    </div>
  )
}
