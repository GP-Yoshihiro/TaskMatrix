import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { MAX_PROJECTS_PER_USER } from '@/lib/domain/projects'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type RecentFile = {
  id: string
  name: string
  updated_at: string
  project_id: string
  projects: { name: string } | null
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ count: projectCount }, { data: recentFiles }] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
    supabase
      .from('files')
      .select('id, name, updated_at, project_id, projects(name)')
      .order('updated_at', { ascending: false })
      .limit(10),
  ])

  const files = (recentFiles ?? []) as unknown as RecentFile[]

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageHeader title="ホーム" description="最近の動きと、プロジェクトの数です。" />

      <Card style={{ display: 'grid', gap: 4 }}>
        <span style={{ color: 'var(--color-fg-muted)', fontSize: '0.85rem' }}>プロジェクト</span>
        <span style={{ fontSize: '1.8rem', fontWeight: 600 }}>
          {projectCount ?? 0} / {MAX_PROJECTS_PER_USER}
        </span>
        <Link href="/projects">プロジェクト一覧へ</Link>
      </Card>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2 className="tm-h2">最近の更新</h2>
        {files.length === 0 ? (
          <p style={{ color: 'var(--color-fg-muted)' }}>更新されたファイルはまだありません。</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {files.map((file) => (
              <li
                key={file.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                }}
              >
                <Link href={`/projects/${file.project_id}/files/${file.id}`}>📄 {file.name}</Link>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
                  {file.projects?.name} / {new Date(file.updated_at).toLocaleString('ja-JP')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
