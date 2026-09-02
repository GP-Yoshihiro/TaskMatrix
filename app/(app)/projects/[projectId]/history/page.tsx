import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HistoryList } from '@/components/app/history-list'
import { HISTORY_PAGE_SIZE } from '@/lib/domain/history'
import { createSupabaseHistoryRepository } from '@/lib/repositories/history'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function HistoryPage({
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

  const entries = await createSupabaseHistoryRepository(supabase).listByProject({
    projectId,
    order: 'desc',
    limit: HISTORY_PAGE_SIZE,
  })

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{project.name} の変更履歴</h1>
        <Link href={`/projects/${projectId}`}>プロジェクトへ戻る</Link>
      </header>

      <p style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
        プロジェクト内のすべてのファイルの変更を、新しい順に表示しています。
        下までスクロールすると続きを読み込みます。
      </p>

      <HistoryList
        projectId={projectId}
        initialEntries={entries}
        initialHasMore={entries.length === HISTORY_PAGE_SIZE}
      />
    </div>
  )
}
