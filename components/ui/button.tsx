'use client'

import type { ButtonHTMLAttributes, CSSProperties } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
}

const VARIANT_STYLE: Record<Variant, CSSProperties> = {
  primary: {
    background: 'var(--color-accent)',
    color: 'var(--color-accent-fg)',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'var(--color-surface)',
    color: 'var(--color-fg)',
    border: '1px solid var(--color-border)',
  },
  danger: {
    background: 'var(--color-danger)',
    color: '#ffffff',
    border: '1px solid transparent',
  },
}

/** すべての見た目をデザイントークン経由で決めるボタン */
export function Button({ variant = 'primary', style, ...props }: Props) {
  return (
    <button
      {...props}
      style={{
        ...VARIANT_STYLE[variant],
        borderRadius: 'var(--radius-md)',
        padding: 'calc(var(--space-unit) * 2.5) calc(var(--space-unit) * 4)',
        fontFamily: 'var(--font-ui)',
        fontSize: '0.95rem',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        transition: 'all var(--motion-duration) var(--motion-easing)',
        ...style,
      }}
    />
  )
}
