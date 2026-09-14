'use client'

import { useMemo } from 'react'
import type { CalendarEntry } from '@/components/features/schedule/calendar-month'
import type { Bounds } from '@/lib/domain/gantt'
import { buildGanttDayRows, ganttHourTicks } from '@/lib/domain/gantt'

/** 段 1 つぶんの高さ。詰めすぎると棒の文字が読めない */
const LANE_HEIGHT = 22

/** 左の日付欄の幅。曜日まで入る幅を確保する */
const DATE_COLUMN = 78

const muted = { color: 'var(--color-fg-muted)' } as const

/**
 * 予定を時間軸の横棒で示す。
 *
 * **日付は縦（左側）、時刻は横。** 1 行がその日の 0 時〜24 時にあたる。
 * 横軸に日付を並べると 1 件あたりの棒が細くなり、
 * 「その日の何時から何時か」が読み取れない。
 */
export function ScheduleGantt({
  entries,
  bounds,
  timezone,
  today,
}: {
  entries: CalendarEntry[]
  bounds: Bounds
  timezone: string
  /** 今日の日付（YYYY-MM-DD）。行を目立たせるために使う */
  today: string
}) {
  const rows = useMemo(
    () => buildGanttDayRows(entries, bounds, timezone),
    [entries, bounds, timezone],
  )
  const ticks = useMemo(() => ganttHourTicks(), [])

  const total = rows.reduce((sum, row) => sum + row.bars.length, 0)

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {/* 時刻の目盛り。日付欄のぶんだけ右にずらして、行の中と位置を合わせる */}
      <div style={{ display: 'flex' }}>
        <span style={{ width: DATE_COLUMN, flexShrink: 0 }} />
        <div style={{ position: 'relative', flex: 1, height: 14, fontSize: '0.68rem', ...muted }}>
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
      </div>

      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        {rows.map((row) => {
          const isToday = row.date === today

          return (
            <div
              key={row.date}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderTop: '1px solid var(--color-border)',
                background: isToday
                  ? 'color-mix(in srgb, var(--color-accent) 7%, transparent)'
                  : 'transparent',
              }}
            >
              {/* 左の日付。ここが縦の軸になる */}
              <span
                style={{
                  width: DATE_COLUMN,
                  flexShrink: 0,
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? 'var(--color-accent)' : 'var(--color-fg-muted)',
                  borderRight: '1px solid var(--color-border)',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.label}
              </span>

              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  height: row.lanes * LANE_HEIGHT + 6,
                  padding: '3px 0',
                }}
              >
                {/* 縦の補助線。棒がどの時刻にあたるかを目で追えるようにする */}
                {ticks.map((tick) => (
                  <span
                    key={`line-${row.date}-${tick.label}`}
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${tick.percent}%`,
                      width: 1,
                      background: 'var(--color-border)',
                      opacity: 0.5,
                    }}
                  />
                ))}

                {row.bars.map((bar) => (
                  <div
                    key={`${row.date}-${bar.id}`}
                    title={`${bar.label}（${bar.timeLabel}）`}
                    style={{
                      position: 'absolute',
                      left: `${bar.leftPercent}%`,
                      width: `${bar.widthPercent}%`,
                      top: 3 + bar.lane * LANE_HEIGHT,
                      height: LANE_HEIGHT - 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '0 6px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.7rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      // 仮案は塗らず破線で囲む。確定済みと見分けが付くように
                      background: bar.draft
                        ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)'
                        : 'var(--color-accent)',
                      color: bar.draft ? 'var(--color-fg)' : 'var(--color-accent-fg)',
                      border: bar.draft
                        ? '1px dashed var(--color-accent)'
                        : '1px solid transparent',
                    }}
                  >
                    {bar.draft && <span style={{ fontWeight: 700 }}>仮</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {bar.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {total === 0 ? (
        <p style={{ ...muted, fontSize: '0.8rem' }}>この期間に予定はありません。</p>
      ) : (
        /* 棒が短いと中の文字が読めない。表でも同じ内容を出す */
        <ul style={{ margin: 0, paddingLeft: '1.2em', fontSize: '0.75rem', ...muted }}>
          {rows.flatMap((row) =>
            row.bars.map((bar) => (
              <li key={`legend-${row.date}-${bar.id}`}>
                {row.label} {bar.timeLabel} — {bar.label}
                {bar.draft && '（仮）'}
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  )
}
