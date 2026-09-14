'use client'

import { useMemo } from 'react'
import type { CalendarEntry } from '@/components/features/schedule/calendar-month'
import type { Bounds } from '@/lib/domain/gantt'
import { assigneeColors, buildGanttTaskRows, ganttTicks } from '@/lib/domain/gantt'

/** 行 1 つぶんの高さ。詰めすぎると押しにくい */
const ROW_HEIGHT = 26

/** 左の工程名欄の幅 */
const LABEL_COLUMN = 150

const muted = { color: 'var(--color-fg-muted)' } as const

/**
 * 予定をガントチャートで示す。
 *
 * **左の縦軸＝作業工程、上の横軸＝日付。** 棒は横に伸びる。
 * 担当ごとに色を分け、誰の受け持ちかを行を読まずに見分けられるようにする。
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
  const rows = useMemo(
    () => buildGanttTaskRows(entries, bounds, timezone),
    [entries, bounds, timezone],
  )
  const ticks = useMemo(() => ganttTicks(bounds), [bounds])
  const colors = useMemo(() => assigneeColors(rows.map((row) => row.assignee)), [rows])

  if (rows.length === 0) {
    return <p style={{ ...muted, fontSize: '0.85rem' }}>この期間に予定はありません。</p>
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {/* 担当の凡例。色だけでは誰の色か分からない */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.75rem' }}>
        {[...colors.entries()].map(([name, color]) => (
          <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              aria-hidden
              style={{ width: 10, height: 10, borderRadius: 2, background: color }}
            />
            {name}
          </span>
        ))}
      </div>

      {/* 横に収まらないときは、この枠の中だけを動かす */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 520 }}>
          {/* 上部の日付。工程名欄のぶんだけ右にずらして、棒と位置を合わせる */}
          <div style={{ display: 'flex' }}>
            <span style={{ width: LABEL_COLUMN, flexShrink: 0 }} />
            <div
              style={{ position: 'relative', flex: 1, height: 16, fontSize: '0.68rem', ...muted }}
            >
              {ticks.map((tick) => (
                <span
                  key={tick.label}
                  style={{
                    position: 'absolute',
                    left: `${tick.percent}%`,
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
            {rows.map((row, index) => (
              <div
                key={row.key}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                }}
              >
                {/* 左の工程名。ここが縦の軸になる */}
                <span
                  title={`${row.label}（${row.assignee}）`}
                  style={{
                    width: LABEL_COLUMN,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0 8px',
                    height: ROW_HEIGHT,
                    fontSize: '0.75rem',
                    borderRight: '1px solid var(--color-border)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      flexShrink: 0,
                      background: colors.get(row.assignee),
                    }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.label}
                  </span>
                </span>

                <div style={{ position: 'relative', flex: 1, height: ROW_HEIGHT }}>
                  {/* 縦の補助線。棒がどの日付にあたるかを目で追えるようにする */}
                  {ticks.map((tick) => (
                    <span
                      key={`line-${row.key}-${tick.label}`}
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
                      key={bar.id}
                      title={`${row.label}／${row.assignee}（${bar.timeLabel}）`}
                      style={{
                        position: 'absolute',
                        left: `${bar.leftPercent}%`,
                        width: `${bar.widthPercent}%`,
                        top: 5,
                        height: ROW_HEIGHT - 10,
                        borderRadius: 3,
                        // 仮案は塗らず破線で囲む。確定済みと見分けが付くように
                        background: bar.draft ? 'transparent' : colors.get(row.assignee),
                        border: bar.draft
                          ? `1px dashed ${colors.get(row.assignee)}`
                          : '1px solid transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 棒には文字が入らない。正確な期間は文字でも出す */}
      <ul style={{ margin: 0, paddingLeft: '1.2em', fontSize: '0.75rem', ...muted }}>
        {rows.flatMap((row) =>
          row.bars.map((bar) => (
            <li key={`legend-${bar.id}`}>
              {row.label}／{row.assignee} — {bar.timeLabel}
              {bar.draft && '（仮）'}
            </li>
          )),
        )}
      </ul>
    </div>
  )
}
