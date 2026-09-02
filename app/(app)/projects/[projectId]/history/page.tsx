import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HistoryView } from '@/components/app/history-view'
import { HISTORY_PAGE_SIZE } from '@/lib/domain/history'
import { parseFilter } from '@/lib/domain/history-filter'
import { createSupabaseHistoryRepository } from '@/lib/repositories/history'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { projectId } = await params
  const query = await searchParams
  const supabase = await createServerSupabaseClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) notFound()

  // ファイル画面から開いたときは、そのファイルで絞り込んだ状態にする
  const filter = parseFilter(
    new URLSearchParams(
      Object.entries(query).flatMap(([key, value]) =>
        typeof value === 'string' ? [[key, value] as [string, string]] : [],
      ),
    ),
  )

  const entries = await createSupabaseHistoryRepository(supabase).listByProject({
    projectId,
    order: 'desc',
    limit: HISTORY_PAGE_SIZE,
    filter,
  })

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1400 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{project.name} の変更履歴</h1>
        <Link href={`/projects/${projectId}`}>プロジェクトへ戻る</Link>
      </header>

      <p style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
        プロジェクト内のすべてのファイルの変更を表示しています。
        下までスクロールすると続きを読み込みます。
        「編集」を押すと、右側に変更箇所が出ます。
      </p>

      <HistoryView
        projectId={projectId}
        initialEntries={entries}
        initialHasMore={entries.length === HISTORY_PAGE_SIZE}
        initialFilter={filter}
      />
    </div>
  )
}
