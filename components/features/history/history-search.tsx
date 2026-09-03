'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  EMPTY_FILTER,
  type HistoryFilter,
  isEmptyFilter,
  monthToRange,
  validateRange,
} from '@/lib/domain/history-filter'

const EXTENSIONS = ['md', 'txt', 'xlsx', 'docx', 'pptx', 'pdf']

const label = { fontSize: '0.78rem', color: 'var(--color-fg-muted)' } as const

/**
 * 変更履歴の絞り込み。
 *
 * ファイル名は入力が止まったら自動で反映する。
 * Enter や項目の移動を待つ作りだと、押し忘れたときに
 * 「入力したのに絞り込まれない」状態になる。
 */
export function HistorySearch({
  filter,
  onChange,
  tags = [],
}: {
  filter: HistoryFilter
  onChange: (filter: HistoryFilter) => void
  /** プロジェクト内で使われているタグ */
  tags?: { id: string; name: string; locked: boolean }[]
}) {
  const [draft, setDraft] = useState(filter)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState('')

  /**
   * 入力が止まったら自動で絞り込む。
   * Enter や項目の移動を待つ作りだと、押し忘れたときに
   * 「入力したのに絞り込まれない」状態になる。
   */
  useEffect(() => {
    if (draft.fileName === filter.fileName) return

    const timer = setTimeout(() => {
      if (validateRange(draft.from, draft.to)) return
      onChange(draft)
    }, 400)

    return () => clearTimeout(timer)
  }, [draft, filter.fileName, onChange])

  function apply(next: HistoryFilter) {
    const message = validateRange(next.from, next.to)
    if (message) {
      setError(message)
      return
    }

    setError(null)
    setDraft(next)
    onChange(next)
  }

  /** 年月を選んだら、その月の初日と末日を期間に入れる */
  function applyMonth(value: string) {
    setMonth(value)
    if (!value) return

    const range = monthToRange(value)
    if (!range.from) return

    apply({ ...draft, from: range.from, to: range.to })
  }

  function clear() {
    setMonth('')
    setError(null)
    setDraft(EMPTY_FILTER)
    onChange(EMPTY_FILTER)
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ display: 'grid', gap: 2 }}>
          <span style={label}>ファイル名</span>
          <Input
            value={draft.fileName}
            onChange={(event) => setDraft({ ...draft, fileName: event.target.value })}
            onKeyDown={(event) => {
              // 待たずに反映したいときのため、Enter でも即座に絞り込む
              if (event.key === 'Enter') apply(draft)
            }}
            placeholder="一部でも可"
            aria-label="ファイル名で絞り込む"
          />
        </div>

        <div style={{ display: 'grid', gap: 2 }}>
          <span style={label}>形式</span>
          <select
            value={draft.extension}
            onChange={(event) => apply({ ...draft, extension: event.target.value })}
            aria-label="ファイル形式で絞り込む"
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-fg)',
              fontSize: '0.9rem',
            }}
          >
            <option value="">すべて</option>
            {EXTENSIONS.map((extension) => (
              <option key={extension} value={extension}>
                {extension}
              </option>
            ))}
          </select>
        </div>

        {tags.length > 0 && (
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={label}>タグ</span>
            <select
              value={draft.tag}
              onChange={(event) => apply({ ...draft, tag: event.target.value })}
              aria-label="タグで絞り込む"
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-fg)',
                fontSize: '0.9rem',
              }}
            >
              <option value="">すべて</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.name}>
                  {tag.locked ? `🔒 ${tag.name}` : tag.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gap: 2 }}>
          <span style={label}>年月</span>
          <input
            type="month"
            value={month}
            onChange={(event) => applyMonth(event.target.value)}
            aria-label="年月で絞り込む"
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-fg)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div style={{ display: 'grid', gap: 2 }}>
          <span style={label}>期間</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              value={draft.from}
              onChange={(event) => apply({ ...draft, from: event.target.value })}
              aria-label="開始日"
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-fg)',
                fontSize: '0.9rem',
              }}
            />
            <span style={label}>〜</span>
            <input
              type="date"
              value={draft.to}
              onChange={(event) => apply({ ...draft, to: event.target.value })}
              aria-label="終了日"
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-fg)',
                fontSize: '0.9rem',
              }}
            />
          </div>
        </div>

        {!isEmptyFilter(draft) && (
          <Button size="sm" variant="secondary" onClick={clear}>
            条件を消す
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" style={{ fontSize: '0.82rem', color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
