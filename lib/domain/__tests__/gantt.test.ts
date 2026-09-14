import { describe, expect, it } from 'vitest'
import { buildGanttDayRows, ganttHourTicks } from '../gantt'

const TZ = 'Asia/Tokyo'
const DAY = { start: '2026-09-14', end: '2026-09-14' }
const WEEK = { start: '2026-09-13', end: '2026-09-19' }

function entry(startsAt: string, endsAt: string, overrides: Record<string, unknown> = {}) {
  return { id: 'e1', label: '資料作成', startsAt, endsAt, draft: false, ...overrides }
}

describe('buildGanttDayRows', () => {
  it('行は日付ごとに作る', () => {
    // 日付の軸を縦にするため、1 日 = 1 行とする
    expect(buildGanttDayRows([], WEEK, TZ)).toHaveLength(7)
    expect(buildGanttDayRows([], DAY, TZ)).toHaveLength(1)
  })

  it('行は範囲の順に並ぶ', () => {
    const rows = buildGanttDayRows([], WEEK, TZ)
    expect(rows[0].date).toBe('2026-09-13')
    expect(rows[6].date).toBe('2026-09-19')
  })

  it('左に出す日付の見出しを添える', () => {
    const rows = buildGanttDayRows([], DAY, TZ)
    expect(rows[0].label).toContain('9/14')
    expect(rows[0].label).toContain('月')
  })

  it('予定を、その日の行に入れる', () => {
    // 日本時間 10:00〜12:00
    const rows = buildGanttDayRows(
      [entry('2026-09-14T01:00:00Z', '2026-09-14T03:00:00Z')],
      WEEK,
      TZ,
    )
    expect(rows.find((row) => row.date === '2026-09-14')?.bars).toHaveLength(1)
    expect(rows.find((row) => row.date === '2026-09-13')?.bars).toHaveLength(0)
  })

  it('位置と幅は、その日の 0 時〜24 時に対する割合', () => {
    // 日本時間 12:00 開始なら、ちょうど半分の位置
    const [row] = buildGanttDayRows(
      [entry('2026-09-14T03:00:00Z', '2026-09-14T09:00:00Z')],
      DAY,
      TZ,
    )
    expect(row.bars[0].leftPercent).toBeCloseTo(50, 5)
    expect(row.bars[0].widthPercent).toBeCloseTo(25, 5)
  })

  it('日をまたぐ予定は、日ごとに切って両方の行へ入れる', () => {
    // 日本時間 9/14 22:00 〜 9/15 02:00
    const rows = buildGanttDayRows(
      [entry('2026-09-14T13:00:00Z', '2026-09-14T17:00:00Z')],
      { start: '2026-09-14', end: '2026-09-15' },
      TZ,
    )
    expect(rows[0].bars).toHaveLength(1)
    expect(rows[1].bars).toHaveLength(1)
    // 前の日は末尾まで、次の日は先頭から
    expect(rows[0].bars[0].leftPercent + rows[0].bars[0].widthPercent).toBeCloseTo(100, 5)
    expect(rows[1].bars[0].leftPercent).toBeCloseTo(0, 5)
  })

  it('範囲外の予定は入らない', () => {
    const rows = buildGanttDayRows(
      [entry('2026-09-25T01:00:00Z', '2026-09-25T02:00:00Z')],
      DAY,
      TZ,
    )
    expect(rows[0].bars).toHaveLength(0)
  })

  it('重なる予定は段を分ける', () => {
    // 同じ段に置くと、片方が隠れて見えなくなる
    const [row] = buildGanttDayRows(
      [
        entry('2026-09-14T01:00:00Z', '2026-09-14T04:00:00Z', { id: 'a' }),
        entry('2026-09-14T02:00:00Z', '2026-09-14T05:00:00Z', { id: 'b' }),
      ],
      DAY,
      TZ,
    )
    expect(row.lanes).toBe(2)
    expect(row.bars.map((bar) => bar.lane)).toEqual([0, 1])
  })

  it('重ならない予定は同じ段に置く', () => {
    const [row] = buildGanttDayRows(
      [
        entry('2026-09-14T01:00:00Z', '2026-09-14T02:00:00Z', { id: 'a' }),
        entry('2026-09-14T03:00:00Z', '2026-09-14T04:00:00Z', { id: 'b' }),
      ],
      DAY,
      TZ,
    )
    expect(row.lanes).toBe(1)
    expect(row.bars.every((bar) => bar.lane === 0)).toBe(true)
  })

  it('予定が無い行の段数は 1', () => {
    // 高さが 0 になると、日付の軸が途切れて見える
    expect(buildGanttDayRows([], DAY, TZ)[0].lanes).toBe(1)
  })

  it('開始が早いものから並べる', () => {
    const [row] = buildGanttDayRows(
      [
        entry('2026-09-14T05:00:00Z', '2026-09-14T06:00:00Z', { id: 'late' }),
        entry('2026-09-14T01:00:00Z', '2026-09-14T02:00:00Z', { id: 'early' }),
      ],
      DAY,
      TZ,
    )
    expect(row.bars.map((bar) => bar.id)).toEqual(['early', 'late'])
  })

  it('とても短い予定でも、見える幅を確保する', () => {
    const [row] = buildGanttDayRows(
      [entry('2026-09-14T01:00:00Z', '2026-09-14T01:00:30Z')],
      DAY,
      TZ,
    )
    expect(row.bars[0].widthPercent).toBeGreaterThan(0)
  })

  it('開始と終了が逆でも壊れない', () => {
    const [row] = buildGanttDayRows(
      [entry('2026-09-14T05:00:00Z', '2026-09-14T01:00:00Z')],
      DAY,
      TZ,
    )
    expect(row.bars.every((bar) => bar.widthPercent >= 0)).toBe(true)
  })

  it('仮案かどうかと、時刻の表示を引き継ぐ', () => {
    const [row] = buildGanttDayRows(
      [entry('2026-09-14T01:00:00Z', '2026-09-14T03:00:00Z', { draft: true })],
      DAY,
      TZ,
    )
    expect(row.bars[0].draft).toBe(true)
    expect(row.bars[0].timeLabel).toMatch(/\d{2}:\d{2}/)
  })
})

describe('ganttHourTicks', () => {
  it('1 日ぶんの時刻の目盛りを返す', () => {
    const ticks = ganttHourTicks()
    expect(ticks.length).toBeGreaterThan(2)
    expect(ticks[0].label).toContain('0')
  })

  it('目盛りは 0〜100 の割合に収まる', () => {
    expect(ganttHourTicks().every((tick) => tick.percent >= 0 && tick.percent < 100)).toBe(true)
  })
})
