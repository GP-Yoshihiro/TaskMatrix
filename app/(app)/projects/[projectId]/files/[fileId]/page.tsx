import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { MarkdownEditor } from '@/components/features/files/markdown-editor'
import { FileTags } from '@/components/features/files/file-tags'
import { TaskExtractPanel } from '@/components/features/tasks/task-extract-panel'
import { createSupabaseAiUsageRepository } from '@/lib/repositories/ai-usage'
import { createSupabaseFileVersionRepository } from '@/lib/repositories/file-versions'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createSupabaseTagRepository } from '@/lib/repositories/tags'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { loadEstimate } from '@/lib/usecases/load-estimate'

/** AI 抽出は 20 秒以上かかることがあるため、実行時間の上限を延ばす */
export const maxDuration = 300

export default async function FilePage({
  params,
}: {
  params: Promise<{ projectId: string; fileId: string }>
}) {
  const { projectId, fileId } = await params
  const supabase = await createServerSupabaseClient()

  const tagRepository = createSupabaseTagRepository(supabase)

  // 版の取得だけはファイルの情報が要る。それ以外は互いに依存しないので束ねる。
  // 順に待つと、待ち時間が足し算になる
  const [file, { data: project }, fileTagList, projectTagList, estimate] =
    await Promise.all([
      createSupabaseFileRepository(supabase).findById(fileId),
      // パンくずにプロジェクト名を出すため、名前だけ引く
      supabase.from('projects').select('name').eq('id', projectId).maybeSingle(),
      tagRepository.listByFile(fileId),
      tagRepository.listByProject(projectId),
      loadEstimate(createSupabaseAiUsageRepository(supabase), 'extract_tasks'),
    ])

  if (!file) notFound()

  const latest = await createSupabaseFileVersionRepository(supabase).findByVersion(
    fileId,
    file.currentVersion,
  )

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageHeader
        projectId={projectId}
        projectName={project?.name ?? null}
        pageLabel={file.name}
        title={file.name}
        actions={
          /* このファイルで絞り込んだ状態で履歴を開く */
          <Link
            href={`/projects/${projectId}/history?fileName=${encodeURIComponent(file.name)}`}
            style={{ fontSize: '0.85rem' }}
          >
            このファイルの変更履歴
          </Link>
        }
      />

      <FileTags
        projectId={projectId}
        fileId={fileId}
        tags={fileTagList}
        available={projectTagList}
      />

      <TaskExtractPanel
        projectId={projectId}
        fileId={fileId}
        fileName={file.name}
        sourceVersion={file.currentVersion}
        estimate={estimate}
      />

      {file.kind === 'binary' ? (
        <p style={{ color: 'var(--color-fg-muted)' }}>
          この形式はアプリ内で編集できません。プロジェクト画面からダウンロードしてご確認ください。
        </p>
      ) : (
        <MarkdownEditor
          projectId={projectId}
          fileId={fileId}
          initialContent={latest?.content ?? ''}
          version={file.currentVersion}
        />
      )}
    </div>
  )
}
