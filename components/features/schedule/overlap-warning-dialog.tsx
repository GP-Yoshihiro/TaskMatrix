'use client'

import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'

export type OverlapPair = {
  draftKey: string
  draftLabel: string
  withLabel: string
  kind: 'draft' | 'confirmed'
}

type Props = {
  open: boolean
  pairs: OverlapPair[]
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 重複したまま確定しようとしたときの警告。
 *
 * 削除の確認ではないため注意文言は出さない。
 * 重複を許すかどうかは利用者の判断であり、ここで拒否はしない。
 * 誤って確定しないよう、初期フォーカスは「戻って修正する」側に置く。
 */
export function OverlapWarningDialog({
  open,
  pairs,
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
          width: 'min(520px, 100%)',
          maxHeight: '80vh',
          overflow: 'auto',
          display: 'grid',
          gap: 12,
        }}
      >
        <h2 id={titleId} style={{ fontSize: '1.05rem', fontWeight: 600 }}>
          重複している予定が {pairs.length} 件あります
        </h2>

        <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
          次の予定が他の予定と時間帯が重なっています。このまま確定できますが、
          問題があれば戻って日時を修正してください。
        </p>

        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
          {pairs.map((pair, index) => (
            <li
              key={`${pair.draftKey}-${index}`}
              style={{
                fontSize: '0.85rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: 8,
              }}
            >
              「{pair.draftLabel}」が
              {pair.kind === 'confirmed' ? '確定済み' : '仮案'}の「{pair.withLabel}」
              と重複しています。
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button ref={cancelRef} variant="secondary" disabled={pending} onClick={onCancel}>
            戻って修正する
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            重複を承知で確定する
          </Button>
        </div>
      </div>
    </div>
  )
}
