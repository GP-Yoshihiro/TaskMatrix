import { describe, expect, it } from 'vitest'
import { buildMonthGrid, formatMonthLabel, shiftMonth } from '@/lib/domain/calendar'

describe('buildMonthGrid', () => {
  it('各週はちょうど 7 セル', () => {
    for (const week of buildMonthGrid(2026, 9)) {
      expect(week).toHaveLength(7)
    }
  })

  it('週の先頭は日曜、末尾は土曜', () => {
    const grid = buildMonthGrid(2026, 9)
    for (const week of grid) {
      expect(week[0].weekday).toBe(0)
      expect(week[6].weekday).toBe(6)
    }
  })

  it('当月の日をすべて含む', () => {
    const days = buildMonthGrid(2026, 9)
      .flat()
      .filter((cell) => cell.inCurrentMonth)
      .map((cell) => cell.date)
    expect(days).toHaveLength(30)
    expect(days[0]).toBe('2026-09-01')
    expect(days[29]).toBe('2026-09-30')
  })

  it('月初の前に前月の日が並ぶ', () => {
    // 2026-09-01 は火曜なので、日・月の 2 日分が前月から入る
    const first = buildMonthGrid(2026, 9)[0]
    expect(first[0].inCurrentMonth).toBe(false)
    expect(first[0].date).toBe('2026-08-30')
    expect(first[1].date).toBe('2026-08-31')
    expect(first[2].date).toBe('2026-09-01')
    expect(first[2].inCurrentMonth).toBe(true)
  })

  it('月末の後に翌月の日が並ぶ', () => {
    const grid = buildMonthGrid(2026, 9)
    const last = grid[grid.length - 1]
    const trailing = last.filter((cell) => !cell.inCurrentMonth)
    expect(trailing.length).toBeGreaterThan(0)
    expect(trailing[0].date.startsWith('2026-10')).toBe(true)
  })

  it('月初が日曜の月でも前月の行を作らない', () => {
    // 2026-11-01 は日曜
    const first = buildMonthGrid(2026, 11)[0]
    expect(first[0].date).toBe('2026-11-01')
    expect(first[0].inCurrentMonth).toBe(true)
  })

  it('うるう年の 2 月は 29 日まで含む', () => {
    const days = buildMonthGrid(2028, 2)
      .flat()
      .filter((cell) => cell.inCurrentMonth)
    expect(days).toHaveLength(29)
    expect(days[28].date).toBe('2028-02-29')
  })

  it('平年の 2 月は 28 日まで', () => {
    const days = buildMonthGrid(2026, 2)
      .flat()
      .filter((cell) => cell.inCurrentMonth)
    expect(days).toHaveLength(28)
  })

  it('12 月をまたいでも壊れない', () => {
    const days = buildMonthGrid(2026, 12)
      .flat()
      .filter((cell) => cell.inCurrentMonth)
    expect(days).toHaveLength(31)
    expect(days[30].date).toBe('2026-12-31')
  })
})

describe('shiftMonth', () => {
  it('翌月へ進む', () => {
    expect(shiftMonth(2026, 9, 1)).toEqual({ year: 2026, month: 10 })
  })

  it('前月へ戻る', () => {
    expect(shiftMonth(2026, 9, -1)).toEqual({ year: 2026, month: 8 })
  })

  it('12 月の翌月は翌年 1 月', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
  })

  it('1 月の前月は前年 12 月', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
  })
})

describe('formatMonthLabel', () => {
  it('日本語の年月を返す', () => {
    expect(formatMonthLabel(2026, 9)).toBe('2026年9月')
    expect(formatMonthLabel(2026, 12)).toBe('2026年12月')
  })
})
