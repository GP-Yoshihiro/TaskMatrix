'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { verifyPasswordAction } from '@/lib/actions/reauth'
import { callAction } from '@/lib/client/safe-action'
import { REAUTH_TTL_MS } from '@/lib/domain/reauth'

const MINUTES = Math.floor(REAUTH_TTL_MS / 60_000)

/**
 * 操作の直前にパスワードを求める。
 *
 * ログイン済みであることと、今その人が操作していることは別物である。
 * 席を離れた間に画面が開いたままでも操作はできてしまうため、
 * 取り返しのつかない操作の前に、もう一度本人であることを確かめる。
 */
export function PasswordGate({
  onUnlocked,
  onCancel,
}: {
  onUnlocked: () => void
  onCancel: () => void
}) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setMessage(null)

    startTransition(async () => {
      const result = await callAction(() => verifyPasswordAction(formData))
      if (result.ok) {
        // 入力値を画面に残さない
        setPassword('')
        onUnlocked()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  return (
    <Card style={{ display: 'grid', gap: 10, borderColor: 'var(--color-accent)' }}>
      <strong style={{ fontSize: '0.9rem' }}>パスワードの確認</strong>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
        招待コードの操作には、ご本人の確認が必要です。
        一度確認すると、{MINUTES} 分間は続けて操作できます。
      </p>
      <form action={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <Input
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          aria-label="パスワード"
          required
          disabled={isPending}
        />
        {message && (
          <p role="alert" style={{ fontSize: '0.82rem', color: 'var(--color-danger)' }}>
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? '確認中…' : '確認する'}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={isPending}>
            やめる
          </Button>
        </div>
      </form>
    </Card>
  )
}
