import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MarkdownEditor } from '@/components/app/markdown-editor'
import { TaskExtractPanel } from '@/components/app/task-extract-panel'
import { createSupabaseAiUsageRepository } from '@/lib/repositories/ai-usage'
import { createSupabaseFileVersionRepository } from '@/lib/repositories/file-versions'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
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

  const estimate = await loadEstimate(
    createSupabaseAiUsageRepository(supabase),
    'extract_tasks',
  )

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{file.name}</h1>
        <Link href={`/projects/${projectId}/history`}>変更履歴</Link>
        <Link href={`/projects/${projectId}`}>プロジェクトへ戻る</Link>
      </header>

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
