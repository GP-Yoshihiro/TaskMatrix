import { PageHeader } from '@/components/layout/page-header'
import { ProjectCreateForm } from '@/components/features/projects/project-create-form'
import { ProjectList } from '@/components/features/projects/project-list'
import { MAX_PROJECTS_PER_USER } from '@/lib/domain/projects'
import { createSupabaseProjectRepository } from '@/lib/repositories/projects'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function ProjectsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser()

  const projects = user
    ? await createSupabaseProjectRepository(supabase).listByOwner(user.id)
    : []

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageHeader
        title="プロジェクト"
        description={`作成したプロジェクトの一覧です（${projects.length} / ${MAX_PROJECTS_PER_USER} 件）。`}
      />
      <ProjectCreateForm disabled={projects.length >= MAX_PROJECTS_PER_USER} />
      <ProjectList projects={projects} />
    </div>
  )
}
