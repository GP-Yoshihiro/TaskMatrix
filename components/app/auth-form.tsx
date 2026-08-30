'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Result } from '@/lib/domain/result'

type Props = {
  title: string
  submitLabel: string
  action: (formData: FormData) => Promise<Result<null>>
  redirectTo: string
  footer: ReactNode
}

/** ログインとサインアップで共有する認証フォーム */
export function AuthForm({ title, submitLabel, action, redirectTo, footer }: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await action(formData)
      if (result.ok) {
        router.push(redirectTo)
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  return (
    <Card style={{ maxWidth: 400, margin: '10vh auto', display: 'grid', gap: 16 }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>{title}</h1>
      <form action={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
            メールアドレス
          </span>
          <Input name="email" type="email" autoComplete="email" required />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
            パスワード（8文字以上）
          </span>
          <Input name="password" type="password" autoComplete="current-password" required />
        </label>
        {message && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {message}
          </p>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? '処理中…' : submitLabel}
        </Button>
      </form>
      <div style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>{footer}</div>
    </Card>
  )
}
