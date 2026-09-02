import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { HistoryView } from '@/components/app/history-view'
import { HISTORY_PAGE_SIZE } from '@/lib/domain/history'
import { parseFilter } from '@/lib/domain/history-filter'
import { createSupabaseHistoryRepository } from '@/lib/repositories/history'
import { createSupabaseTagRepository } from '@/lib/repositories/tags'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { purgeHistory } from '@/lib/usecases/purge-history'

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

  const history = createSupabaseHistoryRepository(supabase)
  const tagRepository = createSupabaseTagRepository(supabase)

  // 容量が上限に近づいていれば、ここで古い履歴を整理する。
  // 定期実行の仕組みが無いため、履歴を見る操作に合わせて行う。
  // 失敗しても画面は出す（整理は付随的な処理のため）
  try {
    await purgeHistory(
      {
        databaseSizeBytes: async () => {
          const { data } = await supabase.rpc('database_size_bytes')
          return Number(data ?? 0)
        },
        listLockedFileIds: (id) => tagRepository.listLockedFileIds(id),
        deleteOldest: (input) => history.deleteOldest(input),
      },
      projectId,
    )
  } catch {
    // 整理できなくても履歴は見られる
  }

  const [entries, tags] = await Promise.all([
    history.listByProject({
      projectId,
      order: 'desc',
      limit: HISTORY_PAGE_SIZE,
      filter,
    }),
    tagRepository.listByProject(projectId),
  ])

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageHeader
        projectId={projectId}
        projectName={project.name}
        pageLabel="変更履歴"
        title="変更履歴"
        description="プロジェクト内のすべてのファイルの変更です。下までスクロールすると続きを読み込みます。「編集」を押すと右側に変更箇所が出ます。"
      />

      <HistoryView
        projectId={projectId}
        initialEntries={entries}
        initialHasMore={entries.length === HISTORY_PAGE_SIZE}
        initialFilter={filter}
        tags={tags}
      />
    </div>
  )
}
