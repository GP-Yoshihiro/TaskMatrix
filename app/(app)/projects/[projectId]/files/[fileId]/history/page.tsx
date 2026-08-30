import Link from 'next/link'
import { notFound } from 'next/navigation'
import { VersionHistory } from '@/components/app/version-history'
import { createSupabaseFileVersionRepository } from '@/lib/repositories/file-versions'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ projectId: string; fileId: string }>
}) {
  const { projectId, fileId } = await params
  const supabase = await createServerSupabaseClient()

  const file = await createSupabaseFileRepository(supabase).findById(fileId)
  if (!file) notFound()

  const versions = await createSupabaseFileVersionRepository(supabase).listByFile(fileId)

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{file.name} の変更履歴</h1>
        <Link href={`/projects/${projectId}/files/${fileId}`}>ファイルへ戻る</Link>
        <Link href={`/projects/${projectId}`}>プロジェクトへ戻る</Link>
      </header>
      <VersionHistory versions={versions} isTextFile={file.kind !== 'binary'} />
    </div>
  )
}
