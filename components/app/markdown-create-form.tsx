'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createMarkdownFileAction } from '@/lib/actions/markdown'

export function MarkdownCreateForm({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    formData.set('projectId', projectId)
    startTransition(async () => {
      const result = await createMarkdownFileAction(formData)
      if (result.ok) router.refresh()
      else setMessage(result.error.message)
    })
  }

  return (
    <form action={handleSubmit} style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input name="name" placeholder="メモ名（.md は省略可）" disabled={isPending} />
        <Button type="submit" variant="secondary" disabled={isPending}>
          Markdown を新規作成
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
