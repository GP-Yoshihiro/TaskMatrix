import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CalendarEntry } from '@/components/features/schedule/calendar-month'
import { ScheduleGantt } from '@/components/features/schedule/schedule-gantt'

const TZ = 'Asia/Tokyo'
const WEEK = { start: '2026-09-13', end: '2026-09-19' }

const ENTRIES: CalendarEntry[] = [
  {
    id: 'a',
    label: '資料作成',
    startsAt: '2026-09-14T01:00:00.000Z', // 日本時間 10:00
    endsAt: '2026-09-14T03:00:00.000Z',
    draft: false,
  },
]

describe('ScheduleGantt の向き', () => {
  it('日付は縦に並ぶ。範囲の日数ぶんの見出しが出る', () => {
    // 日付を横軸に置くと、1 件あたりの棒が細くなり時刻が読み取れない
    render(<ScheduleGantt entries={ENTRIES} bounds={WEEK} timezone={TZ} today="2026-09-14" />)

    for (const label of ['9/13（日）', '9/14（月）', '9/19（土）']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('横軸は時刻の目盛りになる', () => {
    render(<ScheduleGantt entries={ENTRIES} bounds={WEEK} timezone={TZ} today="2026-09-14" />)

    expect(screen.getByText('0時')).toBeInTheDocument()
    expect(screen.getByText('12時')).toBeInTheDocument()
  })

  it('予定は、その日の行に入る', () => {
    const { container } = render(
      <ScheduleGantt entries={ENTRIES} bounds={WEEK} timezone={TZ} today="2026-09-14" />,
    )

    const bar = container.querySelector('[title*="資料作成"]') as HTMLElement | null
    expect(bar).not.toBeNull()
    // 日本時間 10:00 開始なので、左から約 41.7%
    expect(bar?.style.left.startsWith('41.6')).toBe(true)
  })

  it('棒が短くても内容が分かるよう、一覧も併記する', () => {
    render(<ScheduleGantt entries={ENTRIES} bounds={WEEK} timezone={TZ} today="2026-09-14" />)

    const list = screen.getByRole('list')
    expect(within(list).getByText(/9\/14（月）.*資料作成/)).toBeInTheDocument()
  })

  it('予定が無ければ、その旨を伝える', () => {
    render(<ScheduleGantt entries={[]} bounds={WEEK} timezone={TZ} today="2026-09-14" />)

    expect(screen.getByText('この期間に予定はありません。')).toBeInTheDocument()
    // 予定が無くても日付の軸は出す。途切れると範囲が分からなくなる
    expect(screen.getAllByText('9/13（日）').length).toBeGreaterThan(0)
  })
})
