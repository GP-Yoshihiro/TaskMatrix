import { describe, expect, it } from 'vitest'
import {
  UNASSIGNED_LABEL,
  assigneeColors,
  buildGanttTaskRows,
  ganttTicks,
} from '../gantt'

const TZ = 'Asia/Tokyo'
const DAY = { start: '2026-09-14', end: '2026-09-14' }
const WEEK = { start: '2026-09-13', end: '2026-09-19' }

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    label: '基礎工事',
    assignee: '田中',
    startsAt: '2026-09-14T01:00:00Z',
    endsAt: '2026-09-14T03:00:00Z',
    draft: false,
    ...overrides,
  }
}

describe('buildGanttTaskRows', () => {
  it('行は作業工程ごとに作る', () => {
    // 左の縦軸は工程名。同じ工程は 1 行にまとめる
    const rows = buildGanttTaskRows(
      [
        entry({ id: 'a' }),
        entry({ id: 'b', startsAt: '2026-09-16T01:00:00Z', endsAt: '2026-09-16T03:00:00Z' }),
        entry({ id: 'c', label: '内装', assignee: '鈴木' }),
      ],
      WEEK,
      TZ,
    )

    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.label === '基礎工事')?.bars).toHaveLength(2)
  })

  it('担当が違えば別の行にする', () => {
    // 同じ工程でも担当が違えば、色も責任も別
    const rows = buildGanttTaskRows(
      [entry({ id: 'a' }), entry({ id: 'b', assignee: '鈴木' })],
      WEEK,
      TZ,
    )
    expect(rows).toHaveLength(2)
  })

  it('行は最初に始まる工程から並べる', () => {
    const rows = buildGanttTaskRows(
      [
        entry({ id: 'a', label: '後の工程', startsAt: '2026-09-17T01:00:00Z', endsAt: '2026-09-17T02:00:00Z' }),
        entry({ id: 'b', label: '先の工程', startsAt: '2026-09-14T01:00:00Z', endsAt: '2026-09-14T02:00:00Z' }),
      ],
      WEEK,
      TZ,
    )
    expect(rows.map((row) => row.label)).toEqual(['先の工程', '後の工程'])
  })

  it('位置と幅は、範囲全体に対する割合', () => {
    // 7 日の範囲で 2 日目の丸 1 日なら、左は約 1/7
    const rows = buildGanttTaskRows(
      [entry({ startsAt: '2026-09-13T15:00:00Z', endsAt: '2026-09-14T15:00:00Z' })],
      WEEK,
      TZ,
    )
    expect(rows[0].bars[0].leftPercent).toBeCloseTo(100 / 7, 4)
    expect(rows[0].bars[0].widthPercent).toBeCloseTo(100 / 7, 4)
  })

  it('範囲からはみ出す予定は、端で切る', () => {
    const rows = buildGanttTaskRows(
      [entry({ startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-30T00:00:00Z' })],
      WEEK,
      TZ,
    )
    expect(rows[0].bars[0].leftPercent).toBe(0)
    expect(rows[0].bars[0].widthPercent).toBeCloseTo(100, 4)
  })

  it('範囲外の予定は行ごと出さない', () => {
    expect(
      buildGanttTaskRows(
        [entry({ startsAt: '2026-10-01T01:00:00Z', endsAt: '2026-10-01T02:00:00Z' })],
        WEEK,
        TZ,
      ),
    ).toHaveLength(0)
  })

  it('担当が無ければ、未設定として扱う', () => {
    const rows = buildGanttTaskRows([entry({ assignee: '' })], WEEK, TZ)
    expect(rows[0].assignee).toBe(UNASSIGNED_LABEL)
  })

  it('とても短い予定でも、見える幅を確保する', () => {
    const rows = buildGanttTaskRows(
      [entry({ startsAt: '2026-09-14T01:00:00Z', endsAt: '2026-09-14T01:00:30Z' })],
      WEEK,
      TZ,
    )
    expect(rows[0].bars[0].widthPercent).toBeGreaterThan(0)
  })

  it('開始と終了が逆でも壊れない', () => {
    const rows = buildGanttTaskRows(
      [entry({ startsAt: '2026-09-14T05:00:00Z', endsAt: '2026-09-14T01:00:00Z' })],
      WEEK,
      TZ,
    )
    expect(rows[0].bars[0].widthPercent).toBeGreaterThan(0)
  })

  it('仮案かどうかと、期間の表示を引き継ぐ', () => {
    const rows = buildGanttTaskRows([entry({ draft: true })], WEEK, TZ)
    expect(rows[0].bars[0].draft).toBe(true)
    expect(rows[0].bars[0].timeLabel).toMatch(/9\/14/)
  })
})

describe('ganttTicks', () => {
  it('複数日の範囲では、日付を上部の目盛りにする', () => {
    const ticks = ganttTicks(WEEK)
    expect(ticks).toHaveLength(7)
    expect(ticks[0].label).toContain('13')
  })

  it('1 日の範囲では、時刻の目盛りにする', () => {
    // 日付が 1 つしかないと、どの時間帯かが分からない
    const ticks = ganttTicks(DAY)
    expect(ticks.length).toBeGreaterThan(2)
    expect(ticks[0].label).toContain('0')
  })

  it('目盛りは 0〜100 の割合に収まる', () => {
    expect(ganttTicks(WEEK).every((tick) => tick.percent >= 0 && tick.percent < 100)).toBe(true)
  })
})

describe('assigneeColors', () => {
  it('担当ごとに違う色を割り当てる', () => {
    const colors = assigneeColors(['田中', '鈴木'])
    expect(colors.get('田中')).not.toBe(colors.get('鈴木'))
  })

  it('同じ担当には、いつも同じ色を割り当てる', () => {
    // 並び順で色が変わると、日をまたいで見比べられない
    const first = assigneeColors(['田中', '鈴木'])
    const second = assigneeColors(['鈴木', '田中'])
    expect(first.get('田中')).toBe(second.get('田中'))
  })

  it('担当が多くても色を返す', () => {
    const many = Array.from({ length: 20 }, (_, index) => `担当${index}`)
    const colors = assigneeColors(many)
    expect(colors.size).toBe(20)
    expect([...colors.values()].every((color) => color.startsWith('#'))).toBe(true)
  })

  it('未設定には目立たない色を割り当てる', () => {
    const colors = assigneeColors([UNASSIGNED_LABEL, '田中'])
    expect(colors.get(UNASSIGNED_LABEL)).not.toBe(colors.get('田中'))
  })
})
