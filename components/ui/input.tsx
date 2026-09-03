import type { InputHTMLAttributes } from 'react'

/**
 * 入力欄。
 * ホバー・フォーカス・無効の見え方は `.tm-input`（CSS）が持つ。
 */
export function Input({
  style,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={className ? `tm-input ${className}` : 'tm-input'}
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
