'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  extractTasksFromFilesAction,
  registerTasksAction,
} from '@/lib/actions/extraction'
import { callAction } from '@/lib/client/safe-action'
import { allSelected, selectionSummary } from '@/lib/domain/selection'
import type { MergedSuggestion } from '@/lib/domain/merge-suggestions'
import { PRIORITY_LABEL } from '@/lib/domain/tasks'
import { formatEstimatedDays } from '@/lib/domain/estimate-days'

const muted = { color: 'var(--color-fg-muted)' } as const

type Result = {
  suggestions: MergedSuggestion[]
  failures: { fileName: string; message: string }[]
  mergedGroupCount: number
}

/**
 * 選んだ複数の資料から、まとめてタスクを抽出する。
 *
 * これまではファイルを 1 つ開かないと抽出できず、
 * 資料が多いプロジェクトでは手間が大きかった。
 *
 * **まとめた結果は、確かめてから登録する。**
 * 重複の判定は AI に任せており、**別の作業を誤ってまとめる危険**がある。
 * 何をまとめたかを画面に出し、納得したうえで保存してもらう。
 */
export function MultiFileExtractPanel({
  projectId,
  files,
  selected,
  onToggleAll,
  onDone,
}: {
  projectId: string
  files: { id: string; name: string }[]
  selected: Set<string>
  onToggleAll: () => void
  onDone: () => void
}) {
  const [result, setResult] = useState<Result | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const fileIds = files.map((file) => file.id)
  const selectedIds = fileIds.filter((id) => selected.has(id))

  function handleExtract() {
    const agreed = window.confirm(
      `選んだ ${selectedIds.length} 件の資料の本文を Google Gemini API に送信し、タスクを抽出します。\n` +
        `AI の呼び出しは ${selectedIds.length + 1} 回です（資料ごとに 1 回と、重複の判定に 1 回）。\n` +
        '1 日の利用上限に算入されます。\n\n実行してよろしいですか？',
    )
    if (!agreed) return

    setMessage(null)
    setResult(null)

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('fileIds', JSON.stringify(selectedIds))

    startTransition(async () => {
      const response = await callAction(() => extractTasksFromFilesAction(formData))
      if (response.ok) {
        setResult(response.data)
        if (response.data.suggestions.length === 0) {
          setMessage('タスクは見つかりませんでした。')
        }
      } else {
        setMessage(response.error.message)
      }
    })
  }

  function handleRegister() {
    if (!result) return

    setMessage(null)
    const formData = new FormData()
    formData.set('projectId', projectId)
    // まとめた結果を登録する。元になった資料は 1 つに定まらないため送らない
    formData.set('fileId', '')
    formData.set('suggestions', JSON.stringify(result.suggestions))

    startTransition(async () => {
      const response = await callAction(() => registerTasksAction(formData))
      if (response.ok) {
        setMessage(`${response.data} 件のタスクを登録しました。`)
        setResult(null)
        onDone()
        router.refresh()
      } else {
        setMessage(response.error.message)
      }
    })
  }

  return (
    <Card style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem' }}>
          <input
            type="checkbox"
            checked={allSelected(selected, fileIds)}
            onChange={onToggleAll}
            disabled={isPending || fileIds.length === 0}
            aria-label="すべてのファイルを選択"
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          すべて選択
        </label>

        <span style={{ fontSize: '0.82rem', ...muted }}>
          {selectionSummary(selected, fileIds)}
        </span>

        <Button onClick={handleExtract} disabled={isPending || selectedIds.length === 0}>
          {isPending ? '処理中…' : '選んだ資料からタスク抽出'}
        </Button>
      </div>

      <p style={{ fontSize: '0.75rem', ...muted, lineHeight: 1.7 }}>
        選んだ資料の本文が Google Gemini API に送信されます。
        AI の呼び出しは<strong>資料の数 ＋ 1 回</strong>で、1 日の利用上限に算入されます。
      </p>

      {message && (
        <p role="status" style={{ fontSize: '0.85rem' }}>
          {message}
        </p>
      )}

      {result && result.failures.length > 0 && (
        <div style={{ fontSize: '0.82rem', color: 'var(--color-danger)' }}>
          <strong>読み取れなかった資料があります</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: '1.3em' }}>
            {result.failures.map((failure) => (
              <li key={failure.fileName}>
                {failure.fileName}: {failure.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && result.suggestions.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <strong style={{ fontSize: '0.9rem' }}>
            {result.suggestions.length} 件のタスク
            {result.mergedGroupCount > 0 && `（うち ${result.mergedGroupCount} 件はまとめたもの）`}
          </strong>

          {result.mergedGroupCount > 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--color-danger)', lineHeight: 1.7 }}>
              重複の判定は AI が行っています。
              <strong>別の作業がまとめられていないか</strong>、登録の前にご確認ください。
            </p>
          )}

          <ul
            style={{
              margin: 0,
              paddingLeft: '1.2em',
              fontSize: '0.82rem',
              lineHeight: 1.8,
              maxHeight: 260,
              overflowY: 'auto',
            }}
          >
            {result.suggestions.map((suggestion) => (
              <li key={suggestion.mergedKeys.join('-')}>
                {suggestion.title}
                <span style={muted}>
                  （{PRIORITY_LABEL[suggestion.priority]}
                  {suggestion.estimatedDays !== null &&
                    ` / ${formatEstimatedDays(suggestion.estimatedDays)}`}
                  {' / '}
                  {suggestion.mergedFrom.join('・')}）
                </span>
                {suggestion.mergedCount > 1 && (
                  <strong style={{ color: 'var(--color-accent)' }}>
                    {' '}
                    ← {suggestion.mergedCount} 件をまとめました
                  </strong>
                )}
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={handleRegister} disabled={isPending}>
              {isPending ? '登録中…' : 'この内容で登録する'}
            </Button>
            <Button variant="secondary" onClick={() => setResult(null)} disabled={isPending}>
              やめる
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
