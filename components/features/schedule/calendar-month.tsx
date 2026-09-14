'use client'

import { useMemo } from 'react'
import { buildMonthGrid, formatMonthLabel } from '@/lib/domain/calendar'
import { type WorkSettings, overlaps } from '@/lib/domain/schedule'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export type CalendarEntry = {
  id: string
  label: string
  /** 担当。ガントチャートの色分けに使う。空文字は未設定 */
  assignee: string
  startsAt: string
  endsAt: string
  /** 仮案は破線で表示し「仮」バッジを付ける */
  draft: boolean
}

/** その日（稼働タイムゾーン基準）の日付文字列を返す */
function dateKeyIn(iso: string, timezone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function timeIn(iso: string, timezone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/**
 * 月間カレンダー。
 *
 * 確定済みは実線、仮案は破線で示し、
 * 同じ日に時間帯が重なるものには印を付ける。
 */
export function CalendarMonth({
  entries,
  settings,
  anchor,
}: {
  entries: CalendarEntry[]
  settings: WorkSettings
  /**
   * 表示する月（YYYY-MM-DD）。
   *
   * 月の移動は CalendarView が持つ。年・週・日と操作を揃えるため、
   * ここでは受け取った月を描くことに徹する。
   */
  anchor: string
}) {
  const today = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: settings.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const [year, month] = parts.split('-').map(Number)
    return { year, month, date: parts }
  }, [settings.timezone])

  const view = useMemo(() => {
    const [year, month] = anchor.split('-').map(Number)
    return { year, month }
  }, [anchor])

  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view])

  /** 日付ごとに予定をまとめる */
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    for (const entry of entries) {
      const key = dateKeyIn(entry.startsAt, settings.timezone)
      if (!key) continue
      map.set(key, [...(map.get(key) ?? []), entry])
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    }
    return map
  }, [entries, settings.timezone])

  /** 同じ日に重なる予定があるかを判定する */
  function hasOverlap(entry: CalendarEntry, sameDay: CalendarEntry[]): boolean {
    return sameDay.some((other) => other.id !== entry.id && overlaps(entry, other))
  }

  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <div
        role="grid"
        aria-label={`${formatMonthLabel(view.year, view.month)} のカレンダー`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            role="columnheader"
            style={{
              padding: 6,
              textAlign: 'center',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
              color:
                index === 0 || index === 6 ? 'var(--color-fg-muted)' : 'var(--color-fg)',
            }}
          >
            {label}
          </div>
        ))}

        {grid.flat().map((cell) => {
          const sameDay = byDate.get(cell.date) ?? []
          const isWorkingDay = settings.workDays.includes(cell.weekday)
          const isToday = cell.date === today.date

          return (
            <div
              key={cell.date}
              role="gridcell"
              style={{
                minHeight: 92,
                maxHeight: 160,
                overflowY: 'auto',
                padding: 4,
                borderTop: '1px solid var(--color-border)',
                borderRight: '1px solid var(--color-border)',
                background: isWorkingDay ? 'var(--color-bg)' : 'var(--color-surface)',
                opacity: cell.inCurrentMonth ? 1 : 0.45,
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? 'var(--color-accent)' : 'var(--color-fg-muted)',
                  marginBottom: 2,
                }}
              >
                {Number(cell.date.slice(8))}
                {isToday && '（今日）'}
              </div>

              {sameDay.map((entry) => (
                <div
                  key={entry.id}
                  title={`${entry.label} ${timeIn(entry.startsAt, settings.timezone)}〜${timeIn(entry.endsAt, settings.timezone)}`}
                  style={{
                    fontSize: '0.68rem',
                    lineHeight: 1.35,
                    marginBottom: 3,
                    padding: '2px 4px',
                    borderRadius: 'var(--radius-sm)',
                    border: entry.draft
                      ? '1px dashed var(--color-accent)'
                      : '1px solid var(--color-border)',
                    background: entry.draft ? 'transparent' : 'var(--color-surface)',
                    color: entry.draft ? 'var(--color-accent)' : 'var(--color-fg)',
                  }}
                >
                  {hasOverlap(entry, sameDay) && '⚠️ '}
                  {entry.draft && '［仮］'}
                  {timeIn(entry.startsAt, settings.timezone)} {entry.label}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)' }}>
        実線は確定済み、破線と［仮］は未確定の仮案です。⚠️ は同じ日の他の予定と
        時間帯が重なっていることを示します。稼働日でない日は背景を薄くしています。
      </p>
    </section>
  )
}
