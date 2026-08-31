'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateWorkSettingsAction } from '@/lib/actions/work-settings'
import type { WorkSettings } from '@/lib/domain/schedule'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

const labelStyle = { fontSize: '0.8rem', color: 'var(--color-fg-muted)' }

export function WorkSettingsForm({ settings }: { settings: WorkSettings }) {
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await updateWorkSettingsAction(formData)
      if (result.ok) {
        setIsError(false)
        setMessage('稼働条件を保存しました。')
      } else {
        setIsError(true)
        setMessage(result.error.message)
      }
    })
  }

  return (
    <form action={handleSubmit} style={{ display: 'grid', gap: 12 }}>
      <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        <legend style={labelStyle}>稼働する曜日</legend>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {WEEKDAY_LABELS.map((label, index) => (
            <label key={label} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="checkbox"
                name="workDays"
                value={index}
                defaultChecked={settings.workDays.includes(index)}
                disabled={isPending}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div
        style={{
          display: 'grid',
          gap: 10,
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        }}
      >
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={labelStyle}>稼働開始</span>
          <Input
            name="workStart"
            type="time"
            defaultValue={settings.workStart}
            disabled={isPending}
            required
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={labelStyle}>稼働終了</span>
          <Input
            name="workEnd"
            type="time"
            defaultValue={settings.workEnd}
            disabled={isPending}
            required
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={labelStyle}>1日の上限（分）</span>
          <Input
            name="dailyCapacityMinutes"
            type="number"
            min={1}
            defaultValue={settings.dailyCapacityMinutes}
            disabled={isPending}
            required
          />
        </label>
      </div>

      <input type="hidden" name="timezone" value={settings.timezone} />

      {message && (
        <p
          role={isError ? 'alert' : undefined}
          style={{
            fontSize: '0.85rem',
            color: isError ? 'var(--color-danger)' : 'var(--color-fg-muted)',
          }}
        >
          {message}
        </p>
      )}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? '保存中…' : '稼働条件を保存'}
        </Button>
      </div>
    </form>
  )
}
