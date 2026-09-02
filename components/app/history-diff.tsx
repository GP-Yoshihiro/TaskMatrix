'use client'

import { useEffect, useState } from 'react'
import { loadHistoryDetailAction } from '@/lib/actions/history'
import { callAction } from '@/lib/client/safe-action'
import type { Change } from '@/lib/domain/history'
import type { HistoryEntry } from '@/lib/repositories/history'

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * 変更箇所の表示。
 *
 * 差分は一覧に載せず、開いたときだけ取りに行く。
 * 全件分の変更行を一覧に積むと、無限スクロールで重くなるため。
 */
export function HistoryDiff({
  entry,
  onClose,
}: {
  entry: HistoryEntry
  onClose: () => void
}) {
  const [changes, setChanges] = useState<Change[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 親が entry.id を key に渡すため、行が変わるとこの部品ごと作り直される。
  // そのため効果の中で状態を初期化する必要がない
  useEffect(() => {
    let active = true

    const formData = new FormData()
    formData.set('id', entry.id)

    void callAction(() => loadHistoryDetailAction(formData)).then((result) => {
      // 別の行に切り替わったあとの応答は捨てる
      if (!active) return

      if (result.ok) {
        setChanges(result.data.changes)
        setTruncated(result.data.truncated)
      } else {
        setError(result.error.message)
      }
    })

    return () => {
      active = false
    }
  }, [entry.id])

  return (
    <div style={{ display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.95rem' }}>{entry.fileName}</strong>
        <span style={{ fontSize: '0.78rem', color: 'var(--color-fg-muted)' }}>
          {dateTimeFormatter.format(new Date(entry.createdAt))}・{entry.authorName}
          {entry.version !== null && `・v${entry.version}`}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginInlineStart: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-fg-muted)',
            fontSize: '0.82rem',
          }}
        >
          閉じる
        </button>
      </div>

      {error && (
        <p role="alert" style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}

      {!error && changes === null && (
        <p role="status" style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
          読み込み中…
        </p>
      )}

      {changes !== null && changes.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
          本文の変更はありません。
        </p>
      )}

      {changes !== null && changes.length > 0 && (
        <>
          {truncated && (
            <p style={{ fontSize: '0.78rem', color: 'var(--color-fg-muted)' }}>
              変更が多いため、最初の {changes.length} 行のみ保存しています。
            </p>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.78rem',
              }}
            >
              <tbody>
                {changes.map((change, index) => (
                  <tr
                    key={`${change.type}-${change.line}-${index}`}
                    style={{
                      background:
                        change.type === 'added'
                          ? 'color-mix(in srgb, #34a853 14%, transparent)'
                          : 'color-mix(in srgb, #d93025 12%, transparent)',
                    }}
                  >
                    <td
                      style={{
                        padding: '1px 8px',
                        textAlign: 'right',
                        color: 'var(--color-fg-muted)',
                        userSelect: 'none',
                        width: '1%',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {change.line}
                    </td>
                    <td
                      style={{
                        padding: '1px 6px',
                        userSelect: 'none',
                        width: '1%',
                        color: change.type === 'added' ? '#1e7e34' : '#b3261e',
                      }}
                    >
                      {change.type === 'added' ? '+' : '−'}
                    </td>
                    <td style={{ padding: '1px 8px', whiteSpace: 'pre-wrap' }}>
                      {change.text || ' '}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
