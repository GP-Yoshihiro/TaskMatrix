import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ApiTokenPanel } from '@/components/app/api-token-panel'
import { FileList } from '@/components/app/file-list'
import { FileUploadForm } from '@/components/app/file-upload-form'
import { FolderTree } from '@/components/app/folder-tree'
import { MarkdownCreateForm } from '@/components/app/markdown-create-form'
import { buildFolderTree } from '@/lib/domain/folders'
import { createSupabaseApiTokenRepository } from '@/lib/repositories/api-tokens'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createSupabaseFolderRepository } from '@/lib/repositories/folders'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export default async function ProjectDetailPage({
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

  const [folderRows, files] = await Promise.all([
    createSupabaseFolderRepository(supabase).listByProject(projectId),
    createSupabaseFileRepository(supabase).listByProject(projectId),
  ])

  const tokens = await createSupabaseApiTokenRepository(supabase).listByProject(projectId)

  // ショートカットに貼り付ける URL は、いま開いている場所から組み立てる
  const requestHeaders = await headers()
  const host = requestHeaders.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'

  return (
    <div style={{ display: 'grid', gap: 32, maxWidth: 900 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{project.name}</h1>
        <Link href={`/projects/${projectId}/tasks`}>タスク一覧へ</Link>
        <Link href={`/projects/${projectId}/schedule`}>スケジュールへ</Link>
        <Link href={`/projects/${projectId}/chat`}>AI チャットへ</Link>
      </header>
      <FolderTree projectId={projectId} tree={buildFolderTree(folderRows)} />
      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ fontWeight: 600 }}>ファイル</h2>
        <MarkdownCreateForm projectId={projectId} />
        <FileUploadForm projectId={projectId} folderId={null} />
        <FileList projectId={projectId} files={files} />
      </section>
      <ApiTokenPanel
        projectId={projectId}
        tokens={tokens}
        origin={`${protocol}://${host}`}
        configured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
      />
    </div>
  )
}
