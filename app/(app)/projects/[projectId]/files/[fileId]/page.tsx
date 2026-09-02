import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MarkdownEditor } from '@/components/app/markdown-editor'
import { FileTags } from '@/components/app/file-tags'
import { TaskExtractPanel } from '@/components/app/task-extract-panel'
import { createSupabaseAiUsageRepository } from '@/lib/repositories/ai-usage'
import { createSupabaseFileVersionRepository } from '@/lib/repositories/file-versions'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createSupabaseTagRepository } from '@/lib/repositories/tags'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { loadEstimate } from '@/lib/usecases/load-estimate'

/** AI 抽出は 20 秒以上かかることがあるため、実行時間の上限を延ばす */
export const maxDuration = 120

export default async function FilePage({
  params,
}: {
  params: Promise<{ projectId: string; fileId: string }>
}) {
  const { projectId, fileId } = await params
  const supabase = await createServerSupabaseClient()

  const file = await createSupabaseFileRepository(supabase).findById(fileId)
  if (!file) notFound()

  const latest = await createSupabaseFileVersionRepository(supabase).findByVersion(
    fileId,
    file.currentVersion,
  )

  const tagRepository = createSupabaseTagRepository(supabase)
  const [fileTagList, projectTagList] = await Promise.all([
    tagRepository.listByFile(fileId),
    tagRepository.listByProject(projectId),
  ])

  const estimate = await loadEstimate(
    createSupabaseAiUsageRepository(supabase),
    'extract_tasks',
  )

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{file.name}</h1>
        {/* このファイルで絞り込んだ状態で履歴を開く */}
        <Link
          href={`/projects/${projectId}/history?fileName=${encodeURIComponent(file.name)}`}
        >
          変更履歴
        </Link>
        <Link href={`/projects/${projectId}`}>プロジェクトへ戻る</Link>
      </header>

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
