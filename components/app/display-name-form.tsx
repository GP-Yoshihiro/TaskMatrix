'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateDisplayNameAction } from '@/lib/actions/settings'
import { callAction } from '@/lib/client/safe-action'
import { MAX_DISPLAY_NAME_LENGTH } from '@/lib/domain/profile'

export function DisplayNameForm({ current }: { current: string }) {
  const [value, setValue] = useState(current)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    setMessage(null)

    const formData = new FormData()
    formData.set('displayName', value)

    startTransition(async () => {
      const result = await callAction(() => updateDisplayNameAction(formData))
      if (result.ok) {
        setMessage({ text: '表示名を保存しました。', isError: false })
        router.refresh()
      } else {
        setMessage({ text: result.error.message, isError: true })
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="例: 山田"
          aria-label="表示名"
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          disabled={isPending}
        />
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? '保存中…' : '保存'}
        </Button>
      </div>
      {message && (
        <p
          role={message.isError ? 'alert' : 'status'}
          style={{
            fontSize: '0.85rem',
            color: message.isError ? 'var(--color-danger)' : 'var(--color-fg-muted)',
          }}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
