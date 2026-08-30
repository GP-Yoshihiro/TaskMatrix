'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { extractTasksAction, registerTasksAction } from '@/lib/actions/extraction'
import { PRIORITY_LABEL } from '@/lib/domain/tasks'
import type { TaskSuggestion } from '@/lib/usecases/extract-tasks'

export function TaskExtractPanel({
  projectId,
  fileId,
  fileName,
  sourceVersion,
}: {
  projectId: string
  fileId: string
  fileName: string
  sourceVersion: number
}) {
  const [suggestions, setSuggestions] = useState<TaskSuggestion[] | null>(null)
  const [summary, setSummary] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleExtract() {
    const confirmed = window.confirm(
      `「${fileName}」の本文を Google Gemini API に送信してタスクを抽出します。\n` +
        'ファイル名やプロジェクト名は送信しません。\n\n' +
        '実行してよろしいですか？',
    )
    if (!confirmed) return

    setMessage(null)
    setSuggestions(null)

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('fileId', fileId)

    startTransition(async () => {
      const result = await extractTasksAction(formData)
      if (result.ok) {
        setSuggestions(result.data.suggestions)
        setSummary(result.data.summary)
        setSelected(new Set(result.data.suggestions.map((_, index) => index)))
        if (result.data.suggestions.length === 0) {
          setMessage('タスクは見つかりませんでした。')
        }
      } else {
        setMessage(result.error.message)
      }
    })
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function handleRegister() {
    if (!suggestions) return
    const picked = suggestions.filter((_, index) => selected.has(index))
    if (picked.length === 0) {
      setMessage('登録するタスクを選んでください。')
      return
    }

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('fileId', fileId)
    formData.set('sourceVersion', String(sourceVersion))
    formData.set('suggestions', JSON.stringify(picked))

    startTransition(async () => {
      const result = await registerTasksAction(formData)
      if (result.ok) {
        setMessage(`${result.data} 件のタスクを登録しました。`)
        setSuggestions(null)
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ fontWeight: 600 }}>AI タスク抽出</h2>
        <Button onClick={handleExtract} disabled={isPending}>
          {isPending ? '解析中…（最大 2 分）' : 'タスクを抽出'}
        </Button>
        <Link href={`/projects/${projectId}/tasks`}>タスク一覧へ</Link>
        {message && <span style={{ fontSize: '0.85rem' }}>{message}</span>}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
        このファイルの本文が Google Gemini API に送信されます。
        ファイル名・プロジェクト名・アカウント情報は送信しません。
      </p>

      {suggestions && suggestions.length > 0 && (
        <Card style={{ display: 'grid', gap: 12 }}>
          {summary && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>{summary}</p>
          )}
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="checkbox"
                    checked={selected.has(index)}
                    onChange={() => toggle(index)}
                  />
                  <span style={{ fontWeight: 600 }}>{suggestion.title}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-fg-muted)' }}>
                    優先度: {PRIORITY_LABEL[suggestion.priority]}
                    {suggestion.dueDate ? ` / 期限: ${suggestion.dueDate}` : ' / 期限: 未定'}
                    {suggestion.assignee ? ` / 担当: ${suggestion.assignee}` : ''}
                  </span>
                </label>
                {suggestion.description && (
                  <p style={{ fontSize: '0.85rem' }}>{suggestion.description}</p>
                )}
                {suggestion.ambiguityNote && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-danger)' }}>
                    ⚠️ 不透明点: {suggestion.ambiguityNote}
                  </p>
                )}
                {suggestion.aiSuggestion && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
                    💡 改善提案: {suggestion.aiSuggestion}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div>
            <Button onClick={handleRegister} disabled={isPending}>
              選択したタスクを登録（{selected.size} 件）
            </Button>
          </div>
        </Card>
      )}
    </section>
  )
}
