import { describe, expect, it } from 'vitest'
import {
  CALENDAR_RANGES,
  buildWeekDays,
  buildYearDays,
  heatLevel,
  rangeBounds,
  rangeLabel,
  shiftAnchor,
} from '../calendar-range'

const ANCHOR = '2026-09-14' // 月曜

describe('CALENDAR_RANGES', () => {
  it('年・月・週・日の 4 つ', () => {
    expect(CALENDAR_RANGES.map((r) => r.value)).toEqual(['year', 'month', 'week', 'day'])
  })
})

describe('shiftAnchor', () => {
  it('日は 1 日ずつ動く', () => {
    expect(shiftAnchor('day', ANCHOR, 1)).toBe('2026-09-15')
    expect(shiftAnchor('day', ANCHOR, -1)).toBe('2026-09-13')
  })

  it('週は 7 日ずつ動く', () => {
    expect(shiftAnchor('week', ANCHOR, 1)).toBe('2026-09-21')
  })

  it('月は 1 か月ずつ動く', () => {
    expect(shiftAnchor('month', ANCHOR, 1)).toBe('2026-10-14')
  })

  it('月をまたぐとき、末日を超えない', () => {
    // 1/31 の翌月は 2/31 ではない。日付が翌月へこぼれないようにする
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-28')
  })

  it('年は 1 年ずつ動く', () => {
    expect(shiftAnchor('year', ANCHOR, 1)).toBe('2027-09-14')
  })

  it('うるう日から 1 年進めても、存在する日になる', () => {
    expect(shiftAnchor('year', '2028-02-29', 1)).toBe('2029-02-28')
  })
})

describe('rangeBounds', () => {
  it('日は、その日だけ', () => {
    expect(rangeBounds('day', ANCHOR)).toEqual({ start: '2026-09-14', end: '2026-09-14' })
  })

  it('週は、日曜から土曜まで', () => {
    // 9/14 は月曜。前の日曜は 9/13
    expect(rangeBounds('week', ANCHOR)).toEqual({ start: '2026-09-13', end: '2026-09-19' })
  })

  it('日曜を指したときは、その日が週の始まり', () => {
    expect(rangeBounds('week', '2026-09-13').start).toBe('2026-09-13')
  })

  it('月は、1 日から末日まで', () => {
    expect(rangeBounds('month', ANCHOR)).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('年は、1/1 から 12/31 まで', () => {
    expect(rangeBounds('year', ANCHOR)).toEqual({ start: '2026-01-01', end: '2026-12-31' })
  })
})

describe('rangeLabel', () => {
  it('範囲ごとに、今どこを見ているかが分かる', () => {
    expect(rangeLabel('year', ANCHOR)).toBe('2026年')
    expect(rangeLabel('month', ANCHOR)).toBe('2026年9月')
    expect(rangeLabel('day', ANCHOR)).toContain('9月14日')
    expect(rangeLabel('week', ANCHOR)).toContain('9月13日')
  })
})

describe('buildWeekDays', () => {
  it('日曜から 7 日を返す', () => {
    const days = buildWeekDays(ANCHOR)
    expect(days).toHaveLength(7)
    expect(days[0].date).toBe('2026-09-13')
    expect(days[6].date).toBe('2026-09-19')
  })

  it('曜日を添える', () => {
    expect(buildWeekDays(ANCHOR)[0].weekday).toBe(0)
  })
})

describe('buildYearDays', () => {
  it('12 か月ぶんを返す', () => {
    expect(buildYearDays(2026)).toHaveLength(12)
  })

  it('各月の日数が正しい', () => {
    const months = buildYearDays(2026)
    expect(months[0].days).toHaveLength(31)
    expect(months[1].days).toHaveLength(28)
  })

  it('うるう年の 2 月は 29 日', () => {
    expect(buildYearDays(2028)[1].days).toHaveLength(29)
  })
})

describe('heatLevel', () => {
  it('予定が無ければ 0', () => {
    expect(heatLevel(0, 10)).toBe(0)
  })

  it('最も多い日は最大の濃さ', () => {
    expect(heatLevel(10, 10)).toBe(4)
  })

  it('1 件でも必ず色が付く', () => {
    // 0 と見分けが付かないと、予定がある日を見落とす
    expect(heatLevel(1, 100)).toBeGreaterThanOrEqual(1)
  })

  it('最大が 0 でも壊れない', () => {
    expect(heatLevel(0, 0)).toBe(0)
  })
})
