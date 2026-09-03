'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { saveMarkdownAction } from '@/lib/actions/markdown'

/**
 * Markdown の編集とプレビュー。
 *
 * 編集と結果を左右に並べ、書きながら確認できるようにする。
 */
export function MarkdownEditor({
  projectId,
  fileId,
  initialContent,
  version,
}: {
  projectId: string
  fileId: string
  initialContent: string
  version: number
}) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    setMessage(null)
    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('fileId', fileId)
    formData.set('content', content)

    startTransition(async () => {
      const result = await saveMarkdownAction(formData)
      if (result.ok) {
        setMessage(`v${result.data} として保存しました。`)
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? '保存中…' : '保存'}
        </Button>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
          現在のバージョン: v{version}
        </span>
        {message && <span style={{ fontSize: '0.85rem' }}>{message}</span>}
      </div>
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        }}
      >
        <textarea
          aria-label="Markdown 本文"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          style={{
            minHeight: 420,
            background: 'var(--color-bg)',
            color: 'var(--color-fg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 12,
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.9rem',
            resize: 'vertical',
          }}
        />
        <Card style={{ minHeight: 420, overflow: 'auto' }}>
          <div className="markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </Card>
      </div>
    </div>
  )
}
