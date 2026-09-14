import { describe, expect, it } from 'vitest'
import { buildGanttBars, ganttHourTicks } from '../gantt'

const DAY = { start: '2026-09-14', end: '2026-09-14' }

function entry(startsAt: string, endsAt: string, overrides: Record<string, unknown> = {}) {
  return { id: 'e1', label: '資料作成', startsAt, endsAt, draft: false, ...overrides }
}

// 日本時間で計算する
const TZ = 'Asia/Tokyo'

describe('buildGanttBars', () => {
  it('範囲内の予定を棒にする', () => {
    const bars = buildGanttBars([entry('2026-09-14T01:00:00Z', '2026-09-14T03:00:00Z')], DAY, TZ)
    expect(bars).toHaveLength(1)
    expect(bars[0].label).toBe('資料作成')
  })

  it('開始が早いものから並べる', () => {
    const bars = buildGanttBars(
      [
        entry('2026-09-14T05:00:00Z', '2026-09-14T06:00:00Z', { id: 'late' }),
        entry('2026-09-14T01:00:00Z', '2026-09-14T02:00:00Z', { id: 'early' }),
      ],
      DAY,
      TZ,
    )
    expect(bars.map((bar) => bar.id)).toEqual(['early', 'late'])
  })

  it('範囲外の予定は除く', () => {
    const bars = buildGanttBars([entry('2026-09-20T01:00:00Z', '2026-09-20T02:00:00Z')], DAY, TZ)
    expect(bars).toHaveLength(0)
  })

  it('範囲にまたがる予定は、範囲の端で切る', () => {
    // はみ出したまま描くと、棒が枠の外へ出てしまう
    const bars = buildGanttBars(
      [entry('2026-09-13T01:00:00Z', '2026-09-15T01:00:00Z')],
      DAY,
      TZ,
    )
    expect(bars[0].leftPercent).toBe(0)
    expect(bars[0].leftPercent + bars[0].widthPercent).toBeCloseTo(100, 5)
  })

  it('位置と幅は 0〜100 の割合で返す', () => {
    const bars = buildGanttBars([entry('2026-09-14T01:00:00Z', '2026-09-14T03:00:00Z')], DAY, TZ)
    expect(bars[0].leftPercent).toBeGreaterThanOrEqual(0)
    expect(bars[0].leftPercent + bars[0].widthPercent).toBeLessThanOrEqual(100)
  })

  it('とても短い予定でも、見える幅を確保する', () => {
    // 幅 0 だと画面から消え、予定があること自体が伝わらない
    const bars = buildGanttBars(
      [entry('2026-09-14T01:00:00Z', '2026-09-14T01:00:30Z')],
      DAY,
      TZ,
    )
    expect(bars[0].widthPercent).toBeGreaterThan(0)
  })

  it('開始と終了が逆でも壊れない', () => {
    const bars = buildGanttBars(
      [entry('2026-09-14T05:00:00Z', '2026-09-14T01:00:00Z')],
      DAY,
      TZ,
    )
    expect(bars.every((bar) => bar.widthPercent >= 0)).toBe(true)
  })

  it('仮案かどうかを引き継ぐ', () => {
    const bars = buildGanttBars(
      [entry('2026-09-14T01:00:00Z', '2026-09-14T02:00:00Z', { draft: true })],
      DAY,
      TZ,
    )
    expect(bars[0].draft).toBe(true)
  })

  it('時刻の表示を添える', () => {
    // 棒の長さだけでは、正確な時刻が読み取れない
    const bars = buildGanttBars([entry('2026-09-14T01:00:00Z', '2026-09-14T03:00:00Z')], DAY, TZ)
    expect(bars[0].timeLabel).toMatch(/\d{2}:\d{2}/)
  })

  it('複数日の範囲でも位置を割り当てる', () => {
    const week = { start: '2026-09-13', end: '2026-09-19' }
    const bars = buildGanttBars(
      [entry('2026-09-16T01:00:00Z', '2026-09-16T03:00:00Z')],
      week,
      TZ,
    )
    expect(bars[0].leftPercent).toBeGreaterThan(20)
    expect(bars[0].leftPercent).toBeLessThan(80)
  })
})

describe('ganttHourTicks', () => {
  it('1 日の範囲では時刻の目盛りを返す', () => {
    const ticks = ganttHourTicks({ start: '2026-09-14', end: '2026-09-14' })
    expect(ticks.length).toBeGreaterThan(2)
    expect(ticks[0].label).toContain('0')
  })

  it('複数日の範囲では日付の目盛りを返す', () => {
    const ticks = ganttHourTicks({ start: '2026-09-13', end: '2026-09-19' })
    expect(ticks).toHaveLength(7)
    expect(ticks[0].label).toContain('13')
  })

  it('目盛りは 0〜100 の割合に収まる', () => {
    const ticks = ganttHourTicks({ start: '2026-09-13', end: '2026-09-19' })
    expect(ticks.every((tick) => tick.percent >= 0 && tick.percent < 100)).toBe(true)
  })
})
