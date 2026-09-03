'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { createDownloadUrlAction, deleteFileAction } from '@/lib/actions/files'
import { callAction } from '@/lib/client/safe-action'
import type { ProjectFile } from '@/lib/repositories/files'

/**
 * プロジェクト内のファイル一覧。
 *
 * 削除はロック付きのタグで拒否されることがあるため、
 * 結果を確認して理由を画面に出す。
 */
export function FileList({
  projectId,
  files,
}: {
  projectId: string
  files: ProjectFile[]
}) {
  const [target, setTarget] = useState<ProjectFile | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleConfirm() {
    if (!target) return

    setMessage(null)
    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('id', target.id)

    startTransition(async () => {
      const result = await callAction(() => deleteFileAction(formData))
      setTarget(null)

      // 削除できない理由（ロック付きのタグなど）を必ず伝える。
      // 結果を見ないと、押しても何も起きない画面になってしまう
      if (result.ok) router.refresh()
      else setMessage(result.error.message)
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
    return (
      <EmptyState
        icon="📄"
        title="ファイルがまだありません"
        description="上の「Markdown を新規作成」でメモを作るか、「アップロード」から Excel・Word・PowerPoint・PDF を追加できます。"
      />
    )
  }

  return (
    <>
      {message && (
        <p
          role="alert"
          style={{
            fontSize: '0.85rem',
            color: 'var(--color-danger)',
            marginBottom: 8,
          }}
        >
          {message}
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {files.map((file) => (
          <li
            key={file.id}
            className="tm-row"
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              background: 'var(--color-surface)',
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
