'use client'

import { useMemo, useState } from 'react'
import { type CalendarEntry, CalendarMonth } from '@/components/features/schedule/calendar-month'
import { ScheduleGantt } from '@/components/features/schedule/schedule-gantt'
import { Button } from '@/components/ui/button'
import {
  CALENDAR_RANGES,
  type CalendarRange,
  buildWeekDays,
  buildYearDays,
  heatLevel,
  rangeBounds,
  rangeLabel,
  shiftAnchor,
} from '@/lib/domain/calendar-range'
import type { WorkSettings } from '@/lib/domain/schedule'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

const muted = { color: 'var(--color-fg-muted)' } as const

/** その日（稼働タイムゾーン基準）の日付文字列 */
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

function todayKey(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** 濃淡の段階に対応する背景。0 は塗らない */
function heatBackground(level: number): string {
  if (level <= 0) return 'var(--color-border)'
  return `color-mix(in srgb, var(--color-accent) ${level * 22}%, transparent)`
}

/**
 * 予定の表示。年・月・週・日を切り替えられる。
 *
 * 見たい粒度は場面で変わる。月だけだと、その日の時間の並びも、
 * 年間の忙しさの偏りも読み取れない。
 *
 * 棒グラフとカレンダーは同時に出す。切り替えにすると、
 * 「いつからいつまで」と「どの日か」を見比べるたびに操作が要る。
 */
export function CalendarView({
  entries,
  settings,
}: {
  entries: CalendarEntry[]
  settings: WorkSettings
}) {
  const [range, setRange] = useState<CalendarRange>('month')
  const [anchor, setAnchor] = useState(() => todayKey(settings.timezone))

  const bounds = useMemo(() => rangeBounds(range, anchor), [range, anchor])

  // 日付ごとの件数。濃淡表示と、週・日の見出しに使う
  const countByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of entries) {
      const key = dateKeyIn(entry.startsAt, settings.timezone)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [entries, settings.timezone])

  const today = todayKey(settings.timezone)

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <header
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAnchor(shiftAnchor(range, anchor, -1))}
            aria-label="前へ"
          >
            ←
          </Button>
          <strong style={{ fontSize: '0.92rem', minWidth: 150, textAlign: 'center' }}>
            {rangeLabel(range, anchor)}
          </strong>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAnchor(shiftAnchor(range, anchor, 1))}
            aria-label="次へ"
          >
            →
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAnchor(today)}>
            今日
          </Button>
        </div>

        <div role="group" aria-label="表示範囲" style={{ display: 'flex', gap: 4 }}>
          {CALENDAR_RANGES.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={range === option.value ? 'primary' : 'secondary'}
              aria-pressed={range === option.value}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </header>

      {/* 棒グラフ。年は範囲が広すぎて 1 本が点になるため出さない */}
      {range !== 'year' && (
        <ScheduleGantt entries={entries} bounds={bounds} timezone={settings.timezone} />
      )}

      {range === 'month' && (
        <CalendarMonth entries={entries} settings={settings} anchor={anchor} />
      )}

      {range === 'week' && (
        <WeekStrip
          anchor={anchor}
          today={today}
          countByDate={countByDate}
          workDays={settings.workDays}
        />
      )}

      {range === 'day' && (
        <p style={{ fontSize: '0.85rem', ...muted }}>
          {rangeLabel('day', anchor)} の予定は {countByDate.get(anchor) ?? 0} 件です。
        </p>
      )}

      {range === 'year' && (
        <YearHeatmap anchor={anchor} today={today} countByDate={countByDate} />
      )}
    </section>
  )
}

/** 週の 7 日を横に並べる */
function WeekStrip({
  anchor,
  today,
  countByDate,
  workDays,
}: {
  anchor: string
  today: string
  countByDate: Map<string, number>
  workDays: number[]
}) {
  const days = buildWeekDays(anchor)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {days.map((day) => {
        const count = countByDate.get(day.date) ?? 0
        const isToday = day.date === today

        return (
          <div
            key={day.date}
            style={{
              display: 'grid',
              gap: 2,
              padding: 8,
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
              border: isToday
                ? '1px solid var(--color-accent)'
                : '1px solid var(--color-border)',
              // 稼働日でない日は落として、計画の対象外だと分かるようにする
              opacity: workDays.includes(day.weekday) ? 1 : 0.55,
            }}
          >
            <span style={{ fontSize: '0.7rem', ...muted }}>
              {WEEKDAY_LABELS[day.weekday]}
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: isToday ? 700 : 500 }}>
              {Number(day.date.slice(8))}
            </span>
            <span style={{ fontSize: '0.7rem', ...muted }}>
              {count > 0 ? `${count} 件` : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** 1 年ぶんを小さなマスの濃淡で示す */
function YearHeatmap({
  anchor,
  today,
  countByDate,
}: {
  anchor: string
  today: string
  countByDate: Map<string, number>
}) {
  const year = Number(anchor.slice(0, 4))
  const months = useMemo(() => buildYearDays(year), [year])

  // 濃さの基準はその年の最多の日。年ごとに見え方を揃える
  const max = useMemo(() => {
    let highest = 0
    for (const month of months) {
      for (const day of month.days) {
        highest = Math.max(highest, countByDate.get(day.date) ?? 0)
      }
    }
    return highest
  }, [months, countByDate])

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 12,
        }}
      >
        {months.map((month) => (
          <div key={month.month} style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.75rem', ...muted }}>{month.month}月</span>
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}
            >
              {/* 月の初日の曜日まで空けて、曜日の列を揃える */}
              {Array.from({ length: month.days[0].weekday }, (_, index) => (
                <span key={`pad-${index}`} />
              ))}
              {month.days.map((day) => {
                const count = countByDate.get(day.date) ?? 0
                return (
                  <span
                    key={day.date}
                    title={`${day.date}：${count} 件`}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 2,
                      background: heatBackground(heatLevel(count, max)),
                      outline:
                        day.date === today ? '1px solid var(--color-accent)' : undefined,
                    }}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.72rem', ...muted }}>
        <span>少ない</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: heatBackground(level),
            }}
          />
        ))}
        <span>多い</span>
        {max > 0 && <span>（最多 {max} 件／日）</span>}
      </div>
    </div>
  )
}
