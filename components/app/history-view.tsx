'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { HistoryDiff } from '@/components/app/history-diff'
import { HistoryList } from '@/components/app/history-list'
import { HistorySearch } from '@/components/app/history-search'
import type { HistoryFilter } from '@/lib/domain/history-filter'
import {
  DEFAULT_RATIO,
  RATIO_STORAGE_KEY,
  ratioFromPosition,
  readRatio,
} from '@/lib/domain/split-ratio'
import type { HistoryEntry } from '@/lib/repositories/history'

/** これより狭い画面では左右に割らず、上下に積む */
const NARROW_WIDTH = 900

function subscribeToResize(callback: () => void) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

export function HistoryView({
  projectId,
  initialEntries,
  initialHasMore,
  initialFilter,
}: {
  projectId: string
  initialEntries: HistoryEntry[]
  initialHasMore: boolean
  initialFilter: HistoryFilter
}) {
  const [filter, setFilter] = useState(initialFilter)
  const [selected, setSelected] = useState<HistoryEntry | null>(null)
  const [ratio, setRatio] = useState(DEFAULT_RATIO)
  const [dragging, setDragging] = useState(false)
  const restored = useRef(false)
  const container = useRef<HTMLDivElement | null>(null)

  // 画面幅は外の状態なので、状態管理の仕組みで直接読む。
  // 効果の中で状態を書き換えると、余計な再描画を招く
  const narrow = useSyncExternalStore(
    subscribeToResize,
    () => window.innerWidth < NARROW_WIDTH,
    () => false,
  )

  const applyRatio = useCallback((next: number) => {
    setRatio(next)
    try {
      window.localStorage.setItem(RATIO_STORAGE_KEY, String(next))
    } catch {
      // 保存が使えなくても、その場の表示は変えられる
    }
  }, [])

  // ドラッグ中は画面全体で位置を追う。境界から外れても追従させるため
  useEffect(() => {
    if (!dragging) return

    const move = (event: PointerEvent) => {
      const box = container.current?.getBoundingClientRect()
      if (!box) return
      setRatio(ratioFromPosition(event.clientX, box.left, box.width))
    }

    const stop = () => {
      setDragging(false)
      applyRatio(ratio)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
  }, [dragging, ratio, applyRatio])

  /**
   * 記憶した比率は、分割が現れる瞬間に読む。
   * 分割していない間は比率を使わないため、最初に読む必要がない。
   */
  function select(entry: HistoryEntry) {
    if (!restored.current) {
      restored.current = true
      setRatio(readRatio(() => window.localStorage.getItem(RATIO_STORAGE_KEY)))
    }
    setSelected(entry)
  }

  const split = selected !== null && !narrow

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <HistorySearch filter={filter} onChange={setFilter} />

      <div
        ref={container}
        style={{
          display: 'grid',
          // 差分を開いていないときは一覧を全幅で使う
          gridTemplateColumns: split ? `${ratio}fr 8px ${1 - ratio}fr` : '1fr',
          gap: split ? 0 : 14,
          alignItems: 'start',
          // ドラッグ中に文字が選択されるのを防ぐ
          userSelect: dragging ? 'none' : 'auto',
        }}
      >
        <HistoryList
          projectId={projectId}
          initialEntries={initialEntries}
          initialHasMore={initialHasMore}
          filter={filter}
          selectedId={selected?.id ?? null}
          onSelect={select}
        />

        {split && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="表示幅を変える"
            data-testid="history-splitter"
            onPointerDown={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            style={{
              cursor: 'col-resize',
              alignSelf: 'stretch',
              minHeight: 120,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <span
              aria-hidden
              style={{ width: 2, background: 'var(--color-border)', borderRadius: 1 }}
            />
          </div>
        )}

        {selected && (
          // key を付けて、行が変わるたびに作り直す
          <HistoryDiff
            key={selected.id}
            entry={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  )
}
