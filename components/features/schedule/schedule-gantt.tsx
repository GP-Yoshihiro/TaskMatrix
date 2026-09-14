'use client'

import { useMemo } from 'react'
import type { CalendarEntry } from '@/components/features/schedule/calendar-month'
import type { Bounds } from '@/lib/domain/gantt'
import { buildGanttBars, ganttHourTicks } from '@/lib/domain/gantt'

/** 棒 1 本の高さ。詰めすぎると押しにくい */
const ROW_HEIGHT = 30

const muted = { color: 'var(--color-fg-muted)' } as const

/**
 * 予定を時間軸の横棒で示す。
 *
 * 一覧では「いつからいつまで」「重なっているか」「空きがあるか」が読み取れない。
 * 棒の位置と長さで、そこを一目で分かるようにする。
 */
export function ScheduleGantt({
  entries,
  bounds,
  timezone,
}: {
  entries: CalendarEntry[]
  bounds: Bounds
  timezone: string
}) {
  const bars = useMemo(
    () => buildGanttBars(entries, bounds, timezone),
    [entries, bounds, timezone],
  )
  const ticks = useMemo(() => ganttHourTicks(bounds), [bounds])

  if (bars.length === 0) {
    return (
      <p style={{ ...muted, fontSize: '0.85rem' }}>
        この期間に予定はありません。
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {/* 目盛り。棒だけでは、どのあたりの時刻かが読み取れない */}
      <div style={{ position: 'relative', height: 16, fontSize: '0.7rem', ...muted }}>
        {ticks.map((tick) => (
          <span
            key={tick.label}
            style={{
              position: 'absolute',
              left: `${tick.percent}%`,
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
            }}
          >
            {tick.label}
          </span>
        ))}
      </div>

      <div
        style={{
          position: 'relative',
          display: 'grid',
          gap: 4,
          padding: '6px 0',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* 縦の補助線。棒の位置を目で追えるようにする */}
        {ticks.map((tick) => (
          <span
            key={`line-${tick.label}`}
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${tick.percent}%`,
              width: 1,
              background: 'var(--color-border)',
              opacity: 0.6,
            }}
          />
        ))}

        {bars.map((bar) => (
          <div key={bar.id} style={{ position: 'relative', height: ROW_HEIGHT }}>
            <div
              title={`${bar.label}（${bar.timeLabel}）`}
              style={{
                position: 'absolute',
                left: `${bar.leftPercent}%`,
                width: `${bar.widthPercent}%`,
                top: 0,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                // 仮案は塗らず破線で囲む。確定済みと見分けが付くように
                background: bar.draft
                  ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)'
                  : 'var(--color-accent)',
                color: bar.draft ? 'var(--color-fg)' : 'var(--color-accent-fg)',
                border: bar.draft ? '1px dashed var(--color-accent)' : '1px solid transparent',
              }}
            >
              {bar.draft && <span style={{ fontWeight: 700 }}>仮</span>}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{bar.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 棒が短いと中の文字が読めない。表でも同じ内容を出す */}
      <ul style={{ margin: 0, paddingLeft: '1.2em', fontSize: '0.78rem', ...muted }}>
        {bars.map((bar) => (
          <li key={`legend-${bar.id}`}>
            {bar.timeLabel} — {bar.label}
            {bar.draft && '（仮）'}
          </li>
        ))}
      </ul>
    </div>
  )
}
