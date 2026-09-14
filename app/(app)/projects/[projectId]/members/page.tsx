import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { MemberManager } from '@/components/features/members/member-manager'
import { createSupabaseMemberRepository } from '@/lib/repositories/members'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function MembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createServerSupabaseClient()
  const repository = createSupabaseMemberRepository(supabase)

  // 互いに依存しない。順に待つと待ち時間が足し算になる
  const [{ data: project }, members, sections] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', projectId).maybeSingle(),
    repository.listMembers(projectId).catch(() => []),
    repository.listSections(projectId).catch(() => []),
  ])

  if (!project) notFound()

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 760 }}>
      <PageHeader
        projectId={projectId}
        projectName={project.name}
        pageLabel="メンバー"
        title="メンバー"
        description="作業にあたる人と、その所属セクションを登録します。"
      />
      <MemberManager projectId={projectId} members={members} sections={sections} />
    </div>
  )
}
