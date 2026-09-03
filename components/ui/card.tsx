import type { HTMLAttributes } from 'react'

/** 一覧やフォームの土台になる面 */
/**
 * 内容のまとまりを囲う枠。
 *
 * `interactive` を渡すと、押せることが分かるようにホバーが付く。
 * 状態は `.tm-row`（CSS）が持つ。インラインの style では書けない。
 */
export function Card({
  style,
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  const classes = [interactive ? 'tm-row' : '', className].filter(Boolean).join(' ')

  return (
    <div
      {...props}
      className={classes || undefined}
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
