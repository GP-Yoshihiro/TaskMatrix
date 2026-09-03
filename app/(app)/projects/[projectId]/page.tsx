import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { ApiTokenPanel } from '@/components/features/api/api-token-panel'
import { FileList } from '@/components/features/files/file-list'
import { FileUploadForm } from '@/components/features/files/file-upload-form'
import { FolderTree } from '@/components/features/files/folder-tree'
import { MarkdownCreateForm } from '@/components/features/files/markdown-create-form'
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
    <div style={{ display: 'grid', gap: 24 }}>
      <PageHeader
        projectId={projectId}
        projectName={project.name}
        title={project.name}
        description="このプロジェクトのフォルダとファイルです。左の一覧から他の画面へ移れます。"
      />
      <FolderTree projectId={projectId} tree={buildFolderTree(folderRows)} />
      <section style={{ display: 'grid', gap: 12 }}>
        <h2 className="tm-h2">ファイル</h2>
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
