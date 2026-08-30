'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { uploadFileAction } from '@/lib/actions/files'
import { ALLOWED_EXTENSIONS } from '@/lib/domain/files'

export function FileUploadForm({
  projectId,
  folderId,
}: {
  projectId: string
  folderId: string | null
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    formData.set('projectId', projectId)
    formData.set('folderId', folderId ?? '')
    startTransition(async () => {
      const result = await uploadFileAction(formData)
      if (result.ok) router.refresh()
      else setMessage(result.error.message)
    })
  }

  return (
    <form action={handleSubmit} style={{ display: 'grid', gap: 8 }}>
      <input
        type="file"
        name="file"
        aria-label="アップロードするファイル"
        accept={ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(',')}
        disabled={isPending}
      />
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'アップロード中…' : 'アップロード'}
        </Button>
      </div>
      {message && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
          {message}
        </p>
      )}
    </form>
  )
}
