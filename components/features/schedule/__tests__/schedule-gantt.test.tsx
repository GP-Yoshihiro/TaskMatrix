import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CalendarEntry } from '@/components/features/schedule/calendar-month'
import { ScheduleGantt } from '@/components/features/schedule/schedule-gantt'

const TZ = 'Asia/Tokyo'
const WEEK = { start: '2026-09-13', end: '2026-09-19' }

const ENTRIES: CalendarEntry[] = [
  {
    id: 'a',
    label: '基礎工事',
    assignee: '田中',
    startsAt: '2026-09-14T01:00:00.000Z', // 日本時間 10:00
    endsAt: '2026-09-14T03:00:00.000Z',
    draft: false,
  },
  {
    id: 'b',
    label: '内装工事',
    assignee: '鈴木',
    startsAt: '2026-09-16T01:00:00.000Z',
    endsAt: '2026-09-16T05:00:00.000Z',
    draft: true,
  },
  {
    id: 'c',
    label: '検査',
    assignee: '',
    startsAt: '2026-09-18T01:00:00.000Z',
    endsAt: '2026-09-18T02:00:00.000Z',
    draft: false,
  },
]

function setup(entries = ENTRIES) {
  return render(<ScheduleGantt entries={entries} bounds={WEEK} timezone={TZ} />)
}

describe('ScheduleGantt の向き', () => {
  it('作業工程名が左の縦軸に並ぶ', () => {
    const { container } = setup()

    // 左の見出し欄に工程名が出ていること
    for (const name of ['基礎工事', '内装工事', '検査']) {
      expect(container.querySelector(`[title^="${name}"]`)).not.toBeNull()
    }
  })

  it('日付が上部の横軸になる', () => {
    setup()

    // 範囲の 7 日分が目盛りとして並ぶ
    for (const label of ['9/13', '9/14', '9/19']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('棒は日付の位置に応じて横に伸びる', () => {
    const { container } = setup()

    // 左の見出しも同じ語を含むため、棒だけが持つ区切り記号で絞る
    const bar = container.querySelector('[title*="基礎工事／田中"]') as HTMLElement
    // 7 日のうち 2 日目なので、左からおよそ 1/7〜2/7 の間
    const left = Number.parseFloat(bar.style.left)
    expect(left).toBeGreaterThan(100 / 7)
    expect(left).toBeLessThan(200 / 7)
  })
})

describe('ScheduleGantt の担当による色分け', () => {
  it('担当ごとに凡例を出す', () => {
    setup()

    expect(screen.getByText('田中')).toBeInTheDocument()
    expect(screen.getByText('鈴木')).toBeInTheDocument()
    // 担当が空のものは未設定として扱う
    expect(screen.getByText('未設定')).toBeInTheDocument()
  })

  it('担当が違えば違う色になる', () => {
    const { container } = setup()

    const swatches = [...container.querySelectorAll('span[aria-hidden]')]
      .map((node) => (node as HTMLElement).style.background)
      .filter((background) => background.startsWith('rgb'))

    expect(new Set(swatches).size).toBeGreaterThan(1)
  })

  it('同じ担当の工程は、同じ色になる', () => {
    const { container } = setup([
      ENTRIES[0],
      { ...ENTRIES[0], id: 'd', label: '追加工事' },
    ])

    const bars = [...container.querySelectorAll('[title*="田中"]')]
      .map((node) => (node as HTMLElement).style.background)
      .filter((background) => background.startsWith('rgb'))

    expect(new Set(bars).size).toBe(1)
  })
})

describe('ScheduleGantt の補足表示', () => {
  it('棒には文字が入らないため、期間を一覧でも出す', () => {
    setup()

    const list = screen.getByRole('list')
    expect(within(list).getByText(/基礎工事／田中/)).toBeInTheDocument()
  })

  it('仮案は「仮」と分かるようにする', () => {
    setup()

    const list = screen.getByRole('list')
    expect(within(list).getByText(/内装工事.*（仮）/)).toBeInTheDocument()
  })

  it('予定が無ければ、その旨を伝える', () => {
    setup([])

    expect(screen.getByText('この期間に予定はありません。')).toBeInTheDocument()
  })
})
