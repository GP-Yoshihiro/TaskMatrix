import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { TaskManager } from '@/components/features/tasks/task-manager'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function TasksPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createServerSupabaseClient()

  // 両者は互いに依存しない。順に待つと待ち時間が足し算になる。
  // 行レベルセキュリティにより、他人のプロジェクトなら
  // どちらも空で返るため、先に取得しても情報は漏れない
  const [{ data: project }, tasks] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', projectId).maybeSingle(),
    createSupabaseTaskRepository(supabase).listByProject(projectId),
  ])

  if (!project) notFound()

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
