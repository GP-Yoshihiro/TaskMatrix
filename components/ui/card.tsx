import type { HTMLAttributes } from 'react'

/** 一覧やフォームの土台になる面 */
export function Card({ style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'calc(var(--space-unit) * 4)',
        ...style,
      }}
    />
  )
}
