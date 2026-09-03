'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { attachTagAction, detachTagAction } from '@/lib/actions/tags'
import { callAction } from '@/lib/client/safe-action'
import { MAX_TAG_NAME_LENGTH, type Tag } from '@/lib/domain/tag'

export function FileTags({
  projectId,
  fileId,
  tags,
  available,
}: {
  projectId: string
  fileId: string
  /** このファイルに付いているタグ */
  tags: Tag[]
  /** プロジェクト内で既に使われているタグ */
  available: Tag[]
}) {
  const [name, setName] = useState('')
  const [locked, setLocked] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const attached = new Set(tags.map((tag) => tag.id))
  const suggestions = available.filter((tag) => !attached.has(tag.id))

  function attach(tagName: string, withLock: boolean) {
    setMessage(null)

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('fileId', fileId)
    formData.set('name', tagName)
    if (withLock) formData.set('locked', 'on')

    startTransition(async () => {
      const result = await callAction(() => attachTagAction(formData))
      if (result.ok) {
        setName('')
        setLocked(false)
        router.refresh()
      } else {
        setMessage({ text: result.error.message, isError: true })
      }
    })
  }

  function detach(tagId: string) {
    setMessage(null)

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('fileId', fileId)
    formData.set('tagId', tagId)

    startTransition(async () => {
      const result = await callAction(() => detachTagAction(formData))
      if (result.ok) router.refresh()
      else setMessage({ text: result.error.message, isError: true })
    })
  }

  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <h2 className="tm-h2">タグ</h2>

      {tags.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
          タグが付いていません。
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {tags.map((tag) => (
            <li
              key={tag.id}
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: '0.8rem',
                border: '1px solid var(--color-border)',
                background: tag.locked
                  ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                  : 'var(--color-surface)',
              }}
            >
              {/* ロック付きは見れば分かるようにする */}
              {tag.locked && <span aria-label="削除できないタグ">🔒</span>}
              {tag.name}
              <button
                type="button"
                onClick={() => detach(tag.id)}
                disabled={isPending}
                aria-label={`タグ「${tag.name}」を外す`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-fg-muted)',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-fg-muted)' }}>
            使ったことのあるタグ:
          </span>
          {suggestions.map((tag) => (
            <Button
              key={tag.id}
              size="sm"
              variant="secondary"
              onClick={() => attach(tag.name, tag.locked)}
              disabled={isPending}
            >
              {tag.locked ? `🔒 ${tag.name}` : tag.name}
            </Button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && name.trim()) attach(name, locked)
          }}
          placeholder="新しいタグ"
          aria-label="新しいタグの名前"
          maxLength={MAX_TAG_NAME_LENGTH}
          disabled={isPending}
        />
        <label
          style={{
            display: 'flex',
            gap: 4,
            alignItems: 'center',
            fontSize: '0.8rem',
            whiteSpace: 'nowrap',
          }}
        >
          <input
            type="checkbox"
            checked={locked}
            onChange={(event) => setLocked(event.target.checked)}
            disabled={isPending}
          />
          このタグが付いたファイルを削除できないようにする
        </label>
        <Button
          size="sm"
          onClick={() => attach(name, locked)}
          disabled={isPending || name.trim().length === 0}
        >
          追加
        </Button>
      </div>

      {message && (
        <p
          role={message.isError ? 'alert' : 'status'}
          style={{
            fontSize: '0.82rem',
            color: message.isError ? 'var(--color-danger)' : 'var(--color-fg-muted)',
          }}
        >
          {message.text}
        </p>
      )}
    </section>
  )
}
