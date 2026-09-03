import type { ReactNode } from 'react'

/**
 * 何も無いときの表示。
 *
 * 「ありません」の一言だけだと、何をすれば埋まるのかが分からない。
 * 次にできることまで示す。
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  /** 目印。文字だけの画面に手掛かりを与える */
  icon?: string
  title: string
  /** 次に何をすればよいか */
  description?: string
  action?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'grid',
        justifyItems: 'center',
        gap: 6,
        padding: '28px 16px',
        borderRadius: 'var(--radius-md)',
        border: '1px dashed var(--color-border)',
        textAlign: 'center',
      }}
    >
      {icon && (
        <span aria-hidden style={{ fontSize: '1.6rem', opacity: 0.7 }}>
          {icon}
        </span>
      )}
      <p style={{ fontWeight: 600, fontSize: '0.92rem' }}>{title}</p>
      {description && (
        <p
          style={{
            fontSize: '0.82rem',
            color: 'var(--color-fg-muted)',
            lineHeight: 1.6,
            maxWidth: '32rem',
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  )
}
