'use client'

import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { DuplicateTask } from '@/lib/domain/schedule-overwrite'

type Props = {
  open: boolean
  duplicates: DuplicateTask[]
  pending?: boolean
  /** 既存の予定を消して置き換える */
  onOverwrite: () => void
  /** 既存を残したまま追加する */
  onKeepBoth: () => void
  onCancel: () => void
}

/**
 * 再算出した予定を確定するときの、既存の予定との重複の確認。
 *
 * 算出は未完了のタスクすべてを対象にするため、すでに予定が決まっている
 * タスクの分も作られる。そのまま確定すると**同じタスクの予定が二重に増える。**
 *
 * 既定の操作は「両方残す」に置く。置き換えは取り消せないため、
 * 初期フォーカスもそちらに合わせる。
 */
export function OverwriteConfirmDialog({
  open,
  duplicates,
  pending = false,
  onOverwrite,
  onKeepBoth,
  onCancel,
}: Props) {
  const titleId = useId()
  const keepRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    keepRef.current?.focus()
  }, [open])

  if (!open || duplicates.length === 0) return null

  const totalExisting = duplicates.reduce((sum, item) => sum + item.existingCount, 0)
  const touchesGoogle = duplicates.some((item) => item.hasGoogleEvent)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: 'rgba(0, 0, 0, 0.4)',
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: 12,
          width: '100%',
          maxWidth: 460,
          padding: 20,
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <strong id={titleId} style={{ fontSize: '1rem' }}>
          すでに予定があるタスクがあります
        </strong>

        <p style={{ fontSize: '0.85rem', lineHeight: 1.7 }}>
          次の {duplicates.length} 件のタスクには、確定済みの予定が合わせて{' '}
          <strong>{totalExisting} 件</strong>あります。
        </p>

        <ul
          style={{
            margin: 0,
            paddingLeft: '1.3em',
            listStyle: 'disc',
            fontSize: '0.82rem',
            lineHeight: 1.8,
            maxHeight: 160,
            overflowY: 'auto',
          }}
        >
          {duplicates.map((item) => (
            <li key={item.taskId}>
              {item.taskTitle}（既存 {item.existingCount} 件）
              {item.hasGoogleEvent && 'ーカレンダー送信済み'}
            </li>
          ))}
        </ul>

        {touchesGoogle && (
          <p style={{ fontSize: '0.82rem', color: 'var(--color-danger)', lineHeight: 1.7 }}>
            置き換えると、<strong>Google カレンダー側の予定も削除されます。</strong>
            この操作は取り消せません。
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            やめる
          </Button>
          <Button ref={keepRef} variant="secondary" onClick={onKeepBoth} disabled={pending}>
            両方残す
          </Button>
          <Button variant="danger" onClick={onOverwrite} disabled={pending}>
            {pending ? '処理中…' : '置き換える'}
          </Button>
        </div>
      </div>
    </div>
  )
}
