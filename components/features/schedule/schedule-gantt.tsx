'use client'

import { useMemo, useState } from 'react'
import type { CalendarEntry } from '@/components/features/schedule/calendar-month'
import { Button } from '@/components/ui/button'
import {
  GANTT_SORTS,
  type GanttSort,
  type SectionsByAssignee,
  groupGanttRows,
  otherSectionsOf,
} from '@/lib/domain/gantt-group'
import type { Bounds, GanttTaskRow } from '@/lib/domain/gantt'
import { assigneeColors, buildGanttTaskRows, ganttTicks } from '@/lib/domain/gantt'

/** 行 1 つぶんの高さ。詰めすぎると押しにくい */
const ROW_HEIGHT = 26

/** 左の工程名欄の幅 */
const LABEL_COLUMN = 170

const muted = { color: 'var(--color-fg-muted)' } as const

/**
 * 予定をガントチャートで示す。
 *
 * **左の縦軸＝作業工程、上の横軸＝日付。** 棒は横に伸びる。
 * 担当ごとに色を分け、誰の受け持ちかを行を読まずに見分けられるようにする。
 *
 * 担当ごと・セクションごとに見出しで区切れる。
 * **複属のメンバーは最初の所属にだけ出し**、他の所属は名前を押したときに見せる。
 */
export function ScheduleGantt({
  entries,
  bounds,
  timezone,
  sections,
  onOpenTask,
}: {
  entries: CalendarEntry[]
  bounds: Bounds
  timezone: string
  /** 担当名から所属セクションを引く表。先頭が「最初の所属」 */
  sections: SectionsByAssignee
  /** 工程名を押したとき。渡されなければ押せない */
  onOpenTask?: (taskId: string) => void
}) {
  const [sort, setSort] = useState<GanttSort>('start')
  /** 所属を開いている担当。既定では隠す */
  const [openAssignee, setOpenAssignee] = useState<string | null>(null)

  const rows = useMemo(
    () => buildGanttTaskRows(entries, bounds, timezone),
    [entries, bounds, timezone],
  )
  const ticks = useMemo(() => ganttTicks(bounds), [bounds])
  const colors = useMemo(() => assigneeColors(rows.map((row) => row.assignee)), [rows])
  const groups = useMemo(() => groupGanttRows(rows, sort, sections), [rows, sort, sections])

  if (rows.length === 0) {
    return <p style={{ ...muted, fontSize: '0.85rem' }}>この期間に予定はありません。</p>
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
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

        <div role="group" aria-label="並べ替え" style={{ display: 'flex', gap: 4 }}>
          {GANTT_SORTS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={sort === option.value ? 'primary' : 'secondary'}
              aria-pressed={sort === option.value}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 横に収まらないときは、この枠の中だけを動かす */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 560 }}>
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
            {groups.map((group) => (
              <div key={group.key}>
                {group.label !== '' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: 'var(--color-surface)',
                      borderTop: '1px solid var(--color-border)',
                    }}
                  >
                    {group.label}
                    <span style={{ ...muted, fontWeight: 400 }}>{group.count} 件</span>
                  </div>
                )}

                {group.rows.map((row) => (
                  <GanttRow
                    key={`${group.key}-${row.key}`}
                    row={row}
                    ticks={ticks}
                    color={colors.get(row.assignee) ?? 'var(--color-accent)'}
                    others={otherSectionsOf(row.assignee, sections)}
                    onOpenTask={onOpenTask}
                    open={openAssignee === row.assignee}
                    onToggle={() =>
                      setOpenAssignee(openAssignee === row.assignee ? null : row.assignee)
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {sort === 'section' && (
        <p style={{ ...muted, fontSize: '0.72rem' }}>
          複数のセクションに属する人は、最初の所属にだけ出しています。
          名前を押すと、他の所属が見られます。
        </p>
      )}

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

/** 工程 1 行。左に工程名と担当、右に棒 */
function GanttRow({
  row,
  ticks,
  color,
  others,
  open,
  onToggle,
  onOpenTask,
}: {
  row: GanttTaskRow
  ticks: { label: string; percent: number }[]
  color: string
  /** 最初の所属を除いた残り。既定では隠す */
  others: string[]
  open: boolean
  onToggle: () => void
  onOpenTask?: (taskId: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          width: LABEL_COLUMN,
          flexShrink: 0,
          display: 'grid',
          gap: 1,
          padding: '3px 8px',
          minHeight: ROW_HEIGHT,
          borderRight: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        {/* 工程名を押すと、そのタスクの詳細を開く */}
        <button
          type="button"
          title={onOpenTask ? `${row.label} の詳細を開く` : row.label}
          onClick={() => onOpenTask?.(row.taskId)}
          disabled={!onOpenTask}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            padding: 0,
            background: 'none',
            border: 'none',
            textAlign: 'left',
            font: 'inherit',
            fontSize: '0.75rem',
            color: 'inherit',
            cursor: onOpenTask ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          <span
            aria-hidden
            style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: color }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</span>
        </button>

        {/* 名前を押すと、他の所属を出す。既定では隠す */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={others.length > 0 ? open : undefined}
          disabled={others.length === 0}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            textAlign: 'left',
            font: 'inherit',
            fontSize: '0.68rem',
            color: 'var(--color-fg-muted)',
            cursor: others.length > 0 ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {row.assignee}
          {others.length > 0 && (open ? `（${others.join('・')}）` : ` ＋${others.length}`)}
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: ROW_HEIGHT }}>
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
              top: 8,
              height: 12,
              borderRadius: 3,
              // 仮案は塗らず破線で囲む。確定済みと見分けが付くように
              background: bar.draft ? 'transparent' : color,
              border: bar.draft ? `1px dashed ${color}` : '1px solid transparent',
            }}
          />
        ))}
      </div>
    </div>
  )
}
