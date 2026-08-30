'use client'

import { useEffect, useId, useRef } from 'react'
import { Button } from './button'

type Props = {
  open: boolean
  /** ダイアログの見出し。例:「本当に削除しますか？」 */
  title: string
  /** 何が対象かを具体的に伝える文 */
  description?: string
  /** 取り返しがつかないことを伝える注意文言。削除系の操作でのみ渡す */
  warning?: string
  confirmLabel: string
  confirmVariant?: 'primary' | 'danger'
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 取り消せない操作の前に確認を取るダイアログ。
 *
 * window.confirm はブラウザ依存の見た目で、注意文言に強弱を付けられないため
 * 自前で実装している。Escape とオーバーレイのクリックで取り消せる。
 * 破壊的な操作を誤って確定しないよう、初期フォーカスはキャンセル側に置く。
 */
export function ConfirmDialog({
  open,
  title,
  description,
  warning,
  confirmLabel,
  confirmVariant = 'danger',
  pending = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) {
        event.preventDefault()
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    cancelRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, pending, onCancel])

  if (!open) return null

  return (
    <div
      onClick={() => {
        if (!pending) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgb(0 0 0 / 0.42)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          color: 'var(--color-fg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          padding: 'calc(var(--space-unit) * 5)',
          width: 'min(420px, 100%)',
          display: 'grid',
          gap: 12,
        }}
      >
        <h2 id={titleId} style={{ fontSize: '1.05rem', fontWeight: 600 }}>
          {title}
        </h2>

        {description && (
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{description}</p>
        )}

        {warning && (
          <p
            style={{
              fontSize: '0.75rem',
              lineHeight: 1.6,
              color: 'var(--color-danger)',
            }}
          >
            {warning}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button ref={cancelRef} variant="secondary" disabled={pending} onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant={confirmVariant} disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
