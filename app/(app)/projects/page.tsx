import { ProjectCreateForm } from '@/components/app/project-create-form'
import { ProjectList } from '@/components/app/project-list'
import { MAX_PROJECTS_PER_USER } from '@/lib/domain/projects'
import { createSupabaseProjectRepository } from '@/lib/repositories/projects'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function ProjectsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const projects = user
    ? await createSupabaseProjectRepository(supabase).listByOwner(user.id)
    : []

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1000 }}>
      <header style={{ display: 'grid', gap: 4 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>プロジェクト</h1>
        <p style={{ color: 'var(--color-fg-muted)', fontSize: '0.9rem' }}>
          {projects.length} / {MAX_PROJECTS_PER_USER} 件
        </p>
      </header>
      <ProjectCreateForm disabled={projects.length >= MAX_PROJECTS_PER_USER} />
      <ProjectList projects={projects} />
    </div>
  )
}
