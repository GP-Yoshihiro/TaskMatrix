import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryList } from '@/components/features/history/history-list'
import type { HistoryEntry } from '@/lib/repositories/history'

const loadMore = vi.fn()

vi.mock('@/lib/actions/history', () => ({
  loadMoreHistoryAction: (...args: unknown[]) => loadMore(...args),
}))

// IntersectionObserver は jsdom に無いため、観測しない実装で置き換える
beforeEach(() => {
  loadMore.mockReset()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})

function entry(overrides: Partial<HistoryEntry> & { id: string }): HistoryEntry {
  return {
    fileId: 'f1',
    fileName: '要件メモ.md',
    fileExtension: 'md',
    fileKind: 'markdown',
    action: 'updated',
    version: 2,
    addedCount: 3,
    removedCount: 1,
    truncated: false,
    authorName: '山田',
    createdAt: '2026-09-02T01:00:00Z',
    ...overrides,
  }
}

describe('HistoryList', () => {
  it('日付・ファイル名・変更項目・変更者名を並べる', () => {
    render(
      <HistoryList projectId="p1" initialEntries={[entry({ id: 'h1' })]} initialHasMore={false} />,
    )

    const row = screen.getByRole('listitem')

    expect(row.textContent).toContain('2026/09/02')
    expect(row.textContent).toContain('要件メモ.md')
    expect(row.textContent).toContain('編集')
    expect(row.textContent).toContain('山田')
  })

  it('3 つの操作をそれぞれ日本語で示す', () => {
    render(
      <HistoryList
        projectId="p1"
        initialEntries={[
          entry({ id: 'h1', action: 'created' }),
          entry({ id: 'h2', action: 'updated' }),
          entry({ id: 'h3', action: 'deleted' }),
        ]}
        initialHasMore={false}
      />,
    )

    expect(screen.getByText('追加')).toBeInTheDocument()
    expect(screen.getByText('編集')).toBeInTheDocument()
    expect(screen.getByText('削除')).toBeInTheDocument()
  })

  it('編集にだけ下線を引く（後で差分を開けるようにするため）', () => {
    render(
      <HistoryList
        projectId="p1"
        initialEntries={[
          entry({ id: 'h1', action: 'updated' }),
          entry({ id: 'h2', action: 'created' }),
        ]}
        initialHasMore={false}
      />,
    )

    expect(screen.getByText('編集').style.textDecoration).toBe('underline')
    expect(screen.getByText('追加').style.textDecoration).toBe('none')
  })

  it('ファイル名が長くても 1 行に収める', () => {
    // 行の高さが揃っていないと、量が多いときに一覧として読めない
    render(
      <HistoryList
        projectId="p1"
        initialEntries={[entry({ id: 'h1', fileName: 'とても長いファイル名'.repeat(10) })]}
        initialHasMore={false}
      />,
    )

    const name = screen.getByTitle('とても長いファイル名'.repeat(10))

    expect(name.style.whiteSpace).toBe('nowrap')
    expect(name.style.textOverflow).toBe('ellipsis')
  })

  it('形式ごとに違う色の丸を出す', () => {
    const { container } = render(
      <HistoryList
        projectId="p1"
        initialEntries={[
          entry({ id: 'h1', fileExtension: 'md' }),
          entry({ id: 'h2', fileExtension: 'xlsx' }),
        ]}
        initialHasMore={false}
      />,
    )

    const dots = container.querySelectorAll('[aria-hidden]')

    expect(dots).toHaveLength(2)
    expect((dots[0] as HTMLElement).style.background).not.toBe(
      (dots[1] as HTMLElement).style.background,
    )
  })

  it('古い順に切り替えると読み直す', async () => {
    loadMore.mockResolvedValue({
      ok: true,
      data: { entries: [entry({ id: 'h9', fileName: '最初のファイル.md' })], hasMore: false },
    })

    render(
      <HistoryList projectId="p1" initialEntries={[entry({ id: 'h1' })]} initialHasMore={false} />,
    )

    await userEvent.click(screen.getByRole('button', { name: '古い順' }))

    await waitFor(() => {
      expect(screen.getByText('最初のファイル.md')).toBeInTheDocument()
    })

    const formData = loadMore.mock.calls[0][0] as FormData
    expect(formData.get('order')).toBe('asc')
    // 並び替えたら先頭から読み直すので、続きの位置は渡さない
    expect(formData.get('cursorId')).toBeNull()
  })

  it('これ以上無いときはその旨を示す', () => {
    render(
      <HistoryList projectId="p1" initialEntries={[entry({ id: 'h1' })]} initialHasMore={false} />,
    )

    expect(screen.getByText('これ以上の履歴はありません。')).toBeInTheDocument()
  })

  it('続きがあるときは終わりの案内を出さない', () => {
    render(
      <HistoryList projectId="p1" initialEntries={[entry({ id: 'h1' })]} initialHasMore />,
    )

    expect(screen.queryByText('これ以上の履歴はありません。')).not.toBeInTheDocument()
  })
})

describe('HistoryList の絞り込み', () => {
  it('条件が無いときは「まだ」と伝える', () => {
    render(<HistoryList projectId="p1" initialEntries={[]} initialHasMore={false} />)

    expect(screen.getByText('まだ変更履歴がありません')).toBeInTheDocument()
  })

  it('条件があるときは条件に合わないと伝える', () => {
    // 「まだ無い」と「絞り込んだ結果が無い」は原因が違う
    render(
      <HistoryList
        projectId="p1"
        initialEntries={[]}
        initialHasMore={false}
        filter={{ fileName: '存在しない', extension: '', from: '', to: '', tag: '' }}
      />,
    )

    expect(screen.getByText('条件に合う変更履歴がありません')).toBeInTheDocument()
  })

  it('編集を押すと選ばれた行を伝える', () => {
    const onSelect = vi.fn()
    render(
      <HistoryList
        projectId="p1"
        initialEntries={[entry({ id: 'h1', action: 'updated' })]}
        initialHasMore={false}
        onSelect={onSelect}
      />,
    )

    screen.getByRole('button', { name: '編集' }).click()

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1' }))
  })

  it('追加や削除は押せない', () => {
    // 差分が無い操作を押せると、開いても何も出ず戸惑わせる
    const onSelect = vi.fn()
    render(
      <HistoryList
        projectId="p1"
        initialEntries={[
          entry({ id: 'h1', action: 'created' }),
          entry({ id: 'h2', action: 'deleted' }),
        ]}
        initialHasMore={false}
        onSelect={onSelect}
      />,
    )

    expect(screen.queryByRole('button', { name: '追加' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument()
  })

  it('絞り込みの条件を送る', async () => {
    loadMore.mockResolvedValue({ ok: true, data: { entries: [], hasMore: false } })

    const view = render(
      <HistoryList projectId="p1" initialEntries={[]} initialHasMore={false} />,
    )

    view.rerender(
      <HistoryList
        projectId="p1"
        initialEntries={[]}
        initialHasMore={false}
        filter={{ fileName: '要件', extension: 'md', from: '2026-09-01', to: '2026-09-30', tag: '' }}
      />,
    )

    await waitFor(() => expect(loadMore).toHaveBeenCalled())

    const formData = loadMore.mock.calls[0][0] as FormData
    expect(formData.get('fileName')).toBe('要件')
    expect(formData.get('extension')).toBe('md')
    expect(formData.get('from')).toBe('2026-09-01')
    expect(formData.get('to')).toBe('2026-09-30')
  })
})

describe('HistoryList の空状態', () => {
  it('次に何をすればよいかまで伝える', () => {
    // 「ありません」だけだと、何をすれば埋まるのか分からない
    render(<HistoryList projectId="p1" initialEntries={[]} initialHasMore={false} />)

    expect(
      screen.getByText('ファイルを追加・編集・削除すると、ここに記録されます。'),
    ).toBeInTheDocument()
  })

  it('絞り込みで空のときは条件の外し方を案内する', () => {
    render(
      <HistoryList
        projectId="p1"
        initialEntries={[]}
        initialHasMore={false}
        filter={{ fileName: 'x', extension: '', from: '', to: '', tag: '' }}
      />,
    )

    expect(screen.getByText(/条件を緩める/)).toBeInTheDocument()
  })
})
