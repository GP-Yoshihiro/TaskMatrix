'use client'

import type { ButtonHTMLAttributes, CSSProperties, Ref } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'
type Size = 'sm' | 'md'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  ref?: Ref<HTMLButtonElement>
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

const SIZE_STYLE: Record<Size, CSSProperties> = {
  sm: {
    padding: 'calc(var(--space-unit) * 1) calc(var(--space-unit) * 2)',
    fontSize: '0.78rem',
    borderRadius: 'var(--radius-sm)',
  },
  md: {
    padding: 'calc(var(--space-unit) * 2.5) calc(var(--space-unit) * 4)',
    fontSize: '0.95rem',
    borderRadius: 'var(--radius-md)',
  },
}

/** すべての見た目をデザイントークン経由で決めるボタン */
export function Button({ variant = 'primary', size = 'md', style, ...props }: Props) {
  return (
    <button
      {...props}
      style={{
        ...VARIANT_STYLE[variant],
        ...SIZE_STYLE[size],
        fontFamily: 'var(--font-ui)',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        transition: 'all var(--motion-duration) var(--motion-easing)',
        ...style,
      }}
    />
  )
}
