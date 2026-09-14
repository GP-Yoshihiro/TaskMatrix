import { describe, expect, it } from 'vitest'
import { GANTT_SORTS, groupGanttRows, otherSectionsOf } from '../gantt-group'
import { UNASSIGNED_SECTION } from '../member'

function row(label: string, assignee: string) {
  return { key: `${label} ${assignee}`, label, assignee, bars: [] }
}

const ROWS = [
  row('基礎工事', '田中'),
  row('配管', '鈴木'),
  row('内装', '田中'),
  row('検査', '未設定'),
]

// 田中は基礎班と内装班に複属
const SECTIONS: Record<string, string[]> = {
  田中: ['基礎班', '内装班'],
  鈴木: ['基礎班'],
}

describe('GANTT_SORTS', () => {
  it('開始日順・担当ごと・セクションごとの 3 つ', () => {
    expect(GANTT_SORTS.map((sort) => sort.value)).toEqual(['start', 'assignee', 'section'])
  })
})

describe('groupGanttRows', () => {
  it('開始日順では、区切らずそのまま返す', () => {
    const groups = groupGanttRows(ROWS, 'start', SECTIONS)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('')
    expect(groups[0].rows).toHaveLength(4)
  })

  it('開始日順では、元の並びを変えない', () => {
    const groups = groupGanttRows(ROWS, 'start', SECTIONS)
    expect(groups[0].rows.map((item) => item.label)).toEqual([
      '基礎工事',
      '配管',
      '内装',
      '検査',
    ])
  })

  it('担当ごとに区切る', () => {
    const groups = groupGanttRows(ROWS, 'assignee', SECTIONS)
    expect(groups.map((group) => group.label)).toEqual(['田中', '鈴木', '未設定'])
    expect(groups[0].rows.map((item) => item.label)).toEqual(['基礎工事', '内装'])
  })

  it('担当の見出しは、最初に出てきた順に並べる', () => {
    // 名前順にすると、上から読んだときの流れと合わない
    const groups = groupGanttRows([row('配管', '鈴木'), row('基礎', '田中')], 'assignee', SECTIONS)
    expect(groups.map((group) => group.label)).toEqual(['鈴木', '田中'])
  })

  it('セクションごとに区切る', () => {
    const groups = groupGanttRows(ROWS, 'section', SECTIONS)
    expect(groups.map((group) => group.label)).toEqual(['基礎班', UNASSIGNED_SECTION])
  })

  it('複属のメンバーは、最初の所属にだけ出す', () => {
    // 全ての見出しに出すと、工程の合計件数が見出しの合計と一致しなくなる
    const groups = groupGanttRows(ROWS, 'section', SECTIONS)
    const naiso = groups.find((group) => group.label === '内装班')
    expect(naiso).toBeUndefined()

    const kiso = groups.find((group) => group.label === '基礎班')
    expect(kiso?.rows.map((item) => item.label)).toEqual(['基礎工事', '配管', '内装'])
  })

  it('所属が無い担当は未設定にまとめる', () => {
    const groups = groupGanttRows(ROWS, 'section', SECTIONS)
    const none = groups.find((group) => group.label === UNASSIGNED_SECTION)
    expect(none?.rows.map((item) => item.label)).toEqual(['検査'])
  })

  it('どの区切りでも、行の総数は変わらない', () => {
    // 重複して数えていないことを、ここで守る
    for (const mode of ['start', 'assignee', 'section'] as const) {
      const total = groupGanttRows(ROWS, mode, SECTIONS).reduce(
        (sum, group) => sum + group.rows.length,
        0,
      )
      expect(total).toBe(ROWS.length)
    }
  })

  it('見出しに件数を添える', () => {
    const groups = groupGanttRows(ROWS, 'assignee', SECTIONS)
    expect(groups[0].count).toBe(2)
  })

  it('行が無ければ空を返す', () => {
    expect(groupGanttRows([], 'assignee', SECTIONS)).toHaveLength(0)
  })
})

describe('otherSectionsOf', () => {
  it('最初の所属を除いた残りを返す', () => {
    // 既定では隠し、名前を押したときにこれを出す
    expect(otherSectionsOf('田中', SECTIONS)).toEqual(['内装班'])
  })

  it('所属が 1 つなら空', () => {
    expect(otherSectionsOf('鈴木', SECTIONS)).toEqual([])
  })

  it('所属が無ければ空', () => {
    expect(otherSectionsOf('佐藤', SECTIONS)).toEqual([])
  })
})
