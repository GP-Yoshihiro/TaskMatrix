'use client'

import { Input } from '@/components/ui/input'
import { WEIGHT_LABEL, WEIGHT_OVERLAP_HINT } from '@/lib/domain/schedule'
import type { ScheduleDraft } from '@/lib/usecases/plan-schedule'

export type Conflict = { id: string; label: string; kind: 'draft' | 'confirmed' }

/**
 * ISO 8601 を datetime-local が扱う 'YYYY-MM-DDTHH:MM' に変換する。
 * 表示は利用者の稼働タイムゾーンに合わせる。
 */
export function toLocalInputValue(iso: string, timezone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** datetime-local の値を、稼働タイムゾーンの時刻として ISO 8601 に戻す */
export function fromLocalInputValue(value: string, timezone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null

  // いったん UTC として解釈し、そのタイムゾーンでのずれを引いて補正する
  const asUtc = new Date(`${value}:00Z`)
  if (Number.isNaN(asUtc.getTime())) return null

  const shown = toLocalInputValue(asUtc.toISOString(), timezone)
  const shownUtc = new Date(`${shown}:00Z`)
  const offset = shownUtc.getTime() - asUtc.getTime()

  return new Date(asUtc.getTime() - offset).toISOString()
}

export function ScheduleDraftItem({
  draft,
  timezone,
  selected,
  conflicts,
  disabled,
  onToggle,
  onChangeRange,
}: {
  draft: ScheduleDraft
  timezone: string
  selected: boolean
  conflicts: Conflict[]
  disabled: boolean
  onToggle: () => void
  onChangeRange: (startsAt: string, endsAt: string) => void
}) {
  function handleChange(which: 'start' | 'end', value: string) {
    const iso = fromLocalInputValue(value, timezone)
    if (!iso) return
    if (which === 'start') onChangeRange(iso, draft.endsAt)
    else onChangeRange(draft.startsAt, iso)
  }

  return (
    <li
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
        display: 'grid',
        gap: 8,
      }}
    >
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="checkbox" checked={selected} onChange={onToggle} disabled={disabled} />
        <span style={{ fontWeight: 600 }}>{draft.taskTitle}</span>
        <span style={{ fontSize: '0.76rem', color: 'var(--color-fg-muted)' }}>
          重さ: {WEIGHT_LABEL[draft.weight]}
        </span>
      </label>

      <div
        style={{
          display: 'grid',
          gap: 8,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--color-fg-muted)' }}>開始</span>
          <Input
            type="datetime-local"
            aria-label={`${draft.taskTitle} の開始日時`}
            value={toLocalInputValue(draft.startsAt, timezone)}
            disabled={disabled}
            onChange={(event) => handleChange('start', event.target.value)}
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--color-fg-muted)' }}>終了</span>
          <Input
            type="datetime-local"
            aria-label={`${draft.taskTitle} の終了日時`}
            value={toLocalInputValue(draft.endsAt, timezone)}
            disabled={disabled}
            onChange={(event) => handleChange('end', event.target.value)}
          />
        </label>
      </div>

      {draft.reason && <p style={{ fontSize: '0.82rem' }}>{draft.reason}</p>}

      <p style={{ fontSize: '0.76rem', color: 'var(--color-fg-muted)' }}>
        {WEIGHT_OVERLAP_HINT[draft.weight]}
      </p>

      {draft.outOfWorkHours && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>
          ⚠️ 稼働時間外です。日時を編集して調整できます。
        </p>
      )}

      {conflicts.map((conflict) => (
        <p key={conflict.id} style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>
          ⚠️ {conflict.kind === 'confirmed' ? '確定済み' : '仮案'}の「{conflict.label}」
          と重複しています。
        </p>
      ))}
    </li>
  )
}
