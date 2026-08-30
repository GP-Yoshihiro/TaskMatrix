import type { InputHTMLAttributes } from 'react'

export function Input({ style, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        background: 'var(--color-bg)',
        color: 'var(--color-fg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: 'calc(var(--space-unit) * 2) calc(var(--space-unit) * 3)',
        fontFamily: 'var(--font-ui)',
        fontSize: '0.95rem',
        width: '100%',
        ...style,
      }}
    />
  )
}
