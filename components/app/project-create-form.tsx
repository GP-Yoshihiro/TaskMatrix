'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createProjectAction } from '@/lib/actions/projects'

export function ProjectCreateForm({ disabled }: { disabled: boolean }) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await createProjectAction(formData)
      if (result.ok) router.refresh()
      else setMessage(result.error.message)
    })
  }

  return (
    <form action={handleSubmit} style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input name="name" placeholder="新しいプロジェクト名" disabled={disabled || isPending} />
        <Button type="submit" disabled={disabled || isPending}>
          作成
        </Button>
      </div>
      {disabled && (
        <p style={{ color: 'var(--color-fg-muted)', fontSize: '0.85rem' }}>
          プロジェクトは 20 件までです。
        </p>
      )}
      {message && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
          {message}
        </p>
      )}
    </form>
  )
}
