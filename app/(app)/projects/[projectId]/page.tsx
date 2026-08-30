import { notFound } from 'next/navigation'
import { FileList } from '@/components/app/file-list'
import { FileUploadForm } from '@/components/app/file-upload-form'
import { FolderTree } from '@/components/app/folder-tree'
import { buildFolderTree } from '@/lib/domain/folders'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createSupabaseFolderRepository } from '@/lib/repositories/folders'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

  return (
    <div style={{ display: 'grid', gap: 32, maxWidth: 900 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{project.name}</h1>
      <FolderTree projectId={projectId} tree={buildFolderTree(folderRows)} />
      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ fontWeight: 600 }}>ファイル</h2>
        <FileUploadForm projectId={projectId} folderId={null} />
        <FileList projectId={projectId} files={files} />
      </section>
    </div>
  )
}
