import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEntry } from '@/components/features/schedule/calendar-month'
import { CalendarView } from '@/components/features/schedule/calendar-view'
import { DEFAULT_WORK_SETTINGS } from '@/lib/domain/schedule'

const SETTINGS = { ...DEFAULT_WORK_SETTINGS, timezone: 'Asia/Tokyo' }

const ENTRIES: CalendarEntry[] = [
  {
    id: 'a',
    label: '資料作成',
    assignee: '田中',
    startsAt: '2026-09-14T01:00:00.000Z', // 日本時間 10:00
    endsAt: '2026-09-14T03:00:00.000Z',
    draft: false,
  },
  {
    id: 'b',
    label: '打ち合わせ',
    assignee: '鈴木',
    startsAt: '2026-09-16T05:00:00.000Z',
    endsAt: '2026-09-16T06:00:00.000Z',
    draft: true,
  },
]

beforeEach(() => {
  // 「今日」を固定しないと、表示範囲が実行日に左右される。
  // 置き換えるのは Date だけにする。setTimeout まで止めると
  // userEvent の操作が進まなくなる
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-14T03:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

function setup() {
  return {
    user: userEvent.setup(),
    ...render(<CalendarView entries={ENTRIES} settings={SETTINGS} />),
  }
}

describe('CalendarView', () => {
  it('はじめは月を表示する', () => {
    setup()
    expect(screen.getByText('2026年9月')).toBeInTheDocument()
  })

  it('年・月・週・日の切り替えがある', () => {
    setup()
    for (const label of ['年', '月', '週', '日']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('週に切り替えると、その週の範囲を示す', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '週' }))
    expect(screen.getByText(/9月13日 〜 9月19日/)).toBeInTheDocument()
  })

  it('日に切り替えると、その日だけを示す', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '日' }))
    // 見出しと本文の両方に日付が出るため、件数の文で確かめる
    expect(screen.getByText(/の予定は 1 件です/)).toBeInTheDocument()
  })

  it('年に切り替えると、年を示す', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '年' }))
    expect(screen.getByText('2026年')).toBeInTheDocument()
  })

  it('次へ・前へで表示位置が動く', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '次へ' }))
    expect(screen.getByText('2026年10月')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '前へ' }))
    expect(screen.getByText('2026年9月')).toBeInTheDocument()
  })

  it('「今日」で元に戻る', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '次へ' }))
    await user.click(screen.getByRole('button', { name: '今日' }))
    expect(screen.getByText('2026年9月')).toBeInTheDocument()
  })

  it('棒グラフに、その範囲の予定が出る', () => {
    setup()
    // 月表示なので、その月の予定が両方とも棒になる
    expect(screen.getAllByText('資料作成').length).toBeGreaterThan(0)
    expect(screen.getAllByText('打ち合わせ').length).toBeGreaterThan(0)
  })

  it('仮案は「仮」と分かるようにする', () => {
    setup()
    expect(screen.getAllByText(/仮/).length).toBeGreaterThan(0)
  })

  it('年表示では棒グラフを出さない', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '年' }))
    // 1 年を 1 本の棒に詰めると点になり、読み取れない
    expect(screen.queryByText(/〜/)).not.toBeInTheDocument()
  })

  it('選んでいる範囲が分かるようにする', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '週' }))
    expect(screen.getByRole('button', { name: '週' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '月' })).toHaveAttribute('aria-pressed', 'false')
  })
})
