'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { createDownloadUrlAction, deleteFileAction } from '@/lib/actions/files'
import type { ProjectFile } from '@/lib/repositories/files'

export function FileList({
  projectId,
  files,
}: {
  projectId: string
  files: ProjectFile[]
}) {
  const [target, setTarget] = useState<ProjectFile | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleConfirm() {
    if (!target) return
    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('id', target.id)

    startTransition(async () => {
      await deleteFileAction(formData)
      setTarget(null)
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
    <>
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
            <Link href={`/projects/${projectId}/files/${file.id}`} style={{ fontWeight: 500 }}>
              📄 {file.name}
            </Link>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-fg-muted)' }}>
              v{file.currentVersion} / {(file.size / 1024).toFixed(1)} KB
            </span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {file.storagePath && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDownload(file)}
                >
                  ダウンロード
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending}
                aria-label={`ファイル「${file.name}」を削除`}
                onClick={() => setTarget(file)}
                style={{ color: 'var(--color-danger)' }}
              >
                削除
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={target !== null}
        title="本当に削除しますか？"
        description={`ファイル「${target?.name ?? ''}」を削除します。変更履歴もすべて削除されます。`}
        warning="一度削除すると復元はできません。"
        confirmLabel="削除する"
        pending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setTarget(null)}
      />
    </>
  )
}
