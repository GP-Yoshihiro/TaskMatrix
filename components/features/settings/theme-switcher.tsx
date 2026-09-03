'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { updateThemeAction } from '@/lib/actions/settings'
import type { ThemePreference } from '@/lib/platform/theme'

const OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'auto', label: '自動', description: 'ご利用の端末に合わせて切り替えます。' },
  {
    value: 'apple',
    label: 'Apple 風',
    description: '大きめの角丸と柔らかい影で表示します。',
  },
  {
    value: 'windows',
    label: 'Windows 風',
    description: '控えめな角丸とはっきりした境界で表示します。',
  },
]

/**
 * 表示テーマの切り替え（自動 / Apple 風 / Windows 風）。
 */
export function ThemeSwitcher({ current }: { current: ThemePreference }) {
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSelect(value: ThemePreference) {
    setMessage(null)
    const formData = new FormData()
    formData.set('theme', value)
    startTransition(async () => {
      const result = await updateThemeAction(formData)
      if (result.ok) {
        setMessage('テーマを変更しました。')
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={option.value === current ? 'primary' : 'secondary'}
            disabled={isPending}
            aria-pressed={option.value === current}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>
        {OPTIONS.find((option) => option.value === current)?.description}
      </p>
      {message && <p style={{ fontSize: '0.85rem' }}>{message}</p>}
    </div>
  )
}
