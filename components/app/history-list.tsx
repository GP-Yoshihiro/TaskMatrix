'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { loadMoreHistoryAction } from '@/lib/actions/history'
import { callAction } from '@/lib/client/safe-action'
import { ACTION_LABEL, fileColor, summarizeChanges } from '@/lib/domain/history'
import type { HistoryEntry } from '@/lib/repositories/history'

type Order = 'desc' | 'asc'

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * 1 行に収めるための省略。
 * ファイル名と変更者名は幅が足りなければ末尾を省略する。
 * 行の高さが揃っていないと、量が多いときに一覧として読めないため。
 */
const ellipsis = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

export function HistoryList({
  projectId,
  initialEntries,
  initialHasMore,
}: {
  projectId: string
  initialEntries: HistoryEntry[]
  initialHasMore: boolean
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [order, setOrder] = useState<Order>('desc')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const sentinel = useRef<HTMLDivElement | null>(null)

  const load = useCallback(
    async (nextOrder: Order, cursor: HistoryEntry | null) => {
      setLoading(true)
      setMessage(null)

      const formData = new FormData()
      formData.set('projectId', projectId)
      formData.set('order', nextOrder)
      if (cursor) {
        formData.set('cursorCreatedAt', cursor.createdAt)
        formData.set('cursorId', cursor.id)
      }

      const result = await callAction(() => loadMoreHistoryAction(formData))
      setLoading(false)

      if (!result.ok) {
        setMessage(result.error.message)
        return
      }

      setEntries((previous) =>
        cursor ? [...previous, ...result.data.entries] : result.data.entries,
      )
      setHasMore(result.data.hasMore)
    },
    [projectId],
  )

  function changeOrder(next: Order) {
    if (next === order) return
    setOrder(next)
    setEntries([])
    void load(next, null)
  }

  // 末尾が見えたら続きを読む
  useEffect(() => {
    const target = sentinel.current
    if (!target || !hasMore || loading) return

    const observer = new IntersectionObserver((records) => {
      if (!records[0]?.isIntersecting) return
      const last = entries[entries.length - 1]
      void load(order, last ?? null)
    })

    observer.observe(target)
    return () => observer.disconnect()
  }, [entries, hasMore, loading, order, load])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          size="sm"
          variant={order === 'desc' ? 'primary' : 'secondary'}
          onClick={() => changeOrder('desc')}
        >
          新しい順
        </Button>
        <Button
          size="sm"
          variant={order === 'asc' ? 'primary' : 'secondary'}
          onClick={() => changeOrder('asc')}
        >
          古い順
        </Button>
      </div>

      {entries.length === 0 && !loading ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
          まだ変更履歴がありません。
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 2 }}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto auto minmax(0, 1fr) auto minmax(0, 8rem)',
                gap: 10,
                alignItems: 'center',
                padding: '6px 8px',
                borderRadius: 6,
                fontSize: '0.85rem',
                lineHeight: 1.4,
                background: 'var(--color-surface)',
              }}
            >
              {/* ① 形式ごとの色 */}
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: fileColor(entry.fileExtension),
                }}
              />

              {/* ② 日付 */}
              <span style={{ color: 'var(--color-fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {dateFormatter.format(new Date(entry.createdAt)).replaceAll('/', '/')}
              </span>

              {/* ③ ファイル名（省略可） */}
              <span style={ellipsis} title={entry.fileName}>
                {entry.fileName}
              </span>

              {/* ④ 変更項目 */}
              <span
                title={summarizeChanges(entry)}
                style={{
                  whiteSpace: 'nowrap',
                  textDecoration: entry.action === 'updated' ? 'underline' : 'none',
                  color:
                    entry.action === 'deleted' ? 'var(--color-danger)' : 'var(--color-fg)',
                }}
              >
                {ACTION_LABEL[entry.action]}
              </span>

              {/* ⑤ 変更者名（省略可） */}
              <span style={{ ...ellipsis, color: 'var(--color-fg-muted)' }} title={entry.authorName}>
                {entry.authorName}
              </span>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p role="alert" style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>
          {message}
        </p>
      )}

      {loading && (
        <p role="status" style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
          読み込み中…
        </p>
      )}

      {/* ここが見えたら続きを読む */}
      <div ref={sentinel} data-testid="history-sentinel" style={{ height: 1 }} />

      {!hasMore && entries.length > 0 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
          これ以上の履歴はありません。
        </p>
      )}
    </div>
  )
}
