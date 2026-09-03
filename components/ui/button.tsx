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

/**
 * すべての見た目をデザイントークン経由で決めるボタン。
 *
 * ホバー・押下・無効・キーボードの枠は `.tm-button`（CSS）が持つ。
 * インラインの style では書けないうえ、描画のたびに作り直さずに済む。
 */
export function Button({
  variant = 'primary',
  size = 'md',
  style,
  className,
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={className ? `tm-button ${className}` : 'tm-button'}
      style={{
        ...VARIANT_STYLE[variant],
        ...SIZE_STYLE[size],
        ...style,
      }}
    />
  )
}
