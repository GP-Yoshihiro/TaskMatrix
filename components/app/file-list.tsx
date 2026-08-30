'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { createDownloadUrlAction, deleteFileAction } from '@/lib/actions/files'
import type { ProjectFile } from '@/lib/repositories/files'

export function FileList({
  projectId,
  files,
}: {
  projectId: string
  files: ProjectFile[]
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete(file: ProjectFile) {
    const confirmed = window.confirm(`ファイル「${file.name}」を削除します。よろしいですか？`)
    if (!confirmed) return

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('id', file.id)
    startTransition(async () => {
      await deleteFileAction(formData)
      router.refresh()
    })
  }

  function handleDownload(file: ProjectFile) {
    const storagePath = file.storagePath
    if (!storagePath) return
    startTransition(async () => {
      const result = await createDownloadUrlAction(storagePath, file.name)
      if (result.ok) window.open(result.data, '_blank', 'noopener,noreferrer')
      else window.alert(result.error.message)
    })
  }

  if (files.length === 0) {
    return <p style={{ color: 'var(--color-fg-muted)' }}>ファイルがまだありません。</p>
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
      {files.map((file) => (
        <li
          key={file.id}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 12,
          }}
        >
          <Link href={`/projects/${projectId}/files/${file.id}`}>📄 {file.name}</Link>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
            v{file.currentVersion} / {(file.size / 1024).toFixed(1)} KB
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            {file.storagePath && (
              <Button
                variant="secondary"
                disabled={isPending}
                onClick={() => handleDownload(file)}
              >
                ダウンロード
              </Button>
            )}
            <Button variant="danger" disabled={isPending} onClick={() => handleDelete(file)}>
              削除
            </Button>
          </span>
        </li>
      ))}
    </ul>
  )
}
