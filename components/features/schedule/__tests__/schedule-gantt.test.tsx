import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CalendarEntry } from '@/components/features/schedule/calendar-month'
import { ScheduleGantt } from '@/components/features/schedule/schedule-gantt'

const TZ = 'Asia/Tokyo'
const WEEK = { start: '2026-09-13', end: '2026-09-19' }

const ENTRIES: CalendarEntry[] = [
  {
    id: 'a',
    taskId: 't-a',
    label: '基礎工事',
    assignee: '田中',
    startsAt: '2026-09-14T01:00:00.000Z', // 日本時間 10:00
    endsAt: '2026-09-14T03:00:00.000Z',
    draft: false,
  },
  {
    id: 'b',
    taskId: 't-b',
    label: '内装工事',
    assignee: '鈴木',
    startsAt: '2026-09-16T01:00:00.000Z',
    endsAt: '2026-09-16T05:00:00.000Z',
    draft: true,
  },
  {
    id: 'c',
    taskId: 't-c',
    label: '検査',
    assignee: '',
    startsAt: '2026-09-18T01:00:00.000Z',
    endsAt: '2026-09-18T02:00:00.000Z',
    draft: false,
  },
]

// 田中は基礎班と内装班に複属、鈴木は内装班のみ
const SECTIONS = {
  田中: ['基礎班', '内装班'],
  鈴木: ['内装班'],
}

function setup(entries = ENTRIES, sections: Record<string, string[]> = SECTIONS) {
  return render(
    <ScheduleGantt entries={entries} bounds={WEEK} timezone={TZ} sections={sections} />,
  )
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

    // 名前は凡例と各行の両方に出るため、件数では絞らない
    expect(screen.getAllByText(/田中/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/鈴木/).length).toBeGreaterThan(0)
    // 担当が空のものは未設定として扱う
    expect(screen.getAllByText(/未設定/).length).toBeGreaterThan(0)
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

describe('ScheduleGantt の並べ替え', () => {
  it('開始日順・担当ごと・セクションごとを選べる', () => {
    setup()

    for (const label of ['開始日順', '担当ごと', 'セクションごと']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('はじめは開始日順で、見出しを出さない', () => {
    setup()

    expect(screen.getByRole('button', { name: '開始日順' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByText('1 件')).not.toBeInTheDocument()
  })

  it('担当ごとに切り替えると、担当の見出しが出る', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: '担当ごと' }))

    // 見出しには件数を添える
    expect(screen.getAllByText('1 件').length).toBeGreaterThan(0)
  })

  it('セクションごとに切り替えると、セクションの見出しが出る', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'セクションごと' }))

    expect(screen.getByText('基礎班')).toBeInTheDocument()
  })

  it('複属の人は、最初の所属にだけ出す', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'セクションごと' }))

    // 田中は基礎班と内装班に属すが、見出しとして出るのは基礎班のみ。
    // 内装班は鈴木の見出しとしてのみ現れる
    expect(screen.getByText(/最初の所属にだけ出しています/)).toBeInTheDocument()
  })
})

describe('ScheduleGantt の複属の表示', () => {
  it('他の所属は、はじめは出さない', () => {
    setup()

    // 既定で全部出すと、画面が名前で埋まる
    expect(screen.queryByText(/（内装班）/)).not.toBeInTheDocument()
  })

  it('複属していることは、件数で示す', () => {
    setup()

    expect(screen.getByText(/田中 ＋1/)).toBeInTheDocument()
  })

  it('名前を押すと、他の所属が出る', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /田中/ }))

    expect(screen.getByText(/田中（内装班）/)).toBeInTheDocument()
  })

  it('所属が 1 つの人は、押せないようにする', () => {
    setup()

    // 押しても何も起きないボタンは、押せると見せない
    expect(screen.getByRole('button', { name: /鈴木/ })).toBeDisabled()
  })
})

describe('ScheduleGantt からタスクを開く', () => {
  it('工程名を押すと、そのタスクを求める', async () => {
    const onOpenTask = vi.fn()
    const user = userEvent.setup()

    render(
      <ScheduleGantt
        entries={ENTRIES}
        bounds={WEEK}
        timezone={TZ}
        sections={SECTIONS}
        onOpenTask={onOpenTask}
      />,
    )

    // 読み上げ上の名前は本文が優先される。title ではなく本文で探す
    await user.click(screen.getByRole('button', { name: '基礎工事' }))

    expect(onOpenTask).toHaveBeenCalledWith('t-a')
  })

  it('開く手段が無ければ、押せないようにする', () => {
    // 押しても何も起きないものを、押せると見せない
    render(<ScheduleGantt entries={ENTRIES} bounds={WEEK} timezone={TZ} sections={SECTIONS} />)

    expect(screen.getByRole('button', { name: '基礎工事' })).toBeDisabled()
  })
})
