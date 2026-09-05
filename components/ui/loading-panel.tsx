'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SLOW_MS, STALLED_MS, loadingNotice } from '@/lib/domain/loading-notice'

/** 経過を見に行く間隔。細かく刻んでも表示は変わらない */
const TICK_MS = 500

/**
 * 画面の骨組みと、長引いたときの知らせ。
 *
 * 押した直後にこれが出ることで、待ち時間の間も画面が動いて見える。
 * 何も出さずに待たせると、押せていないのか処理中なのか分からない。
 */
export function LoadingPanel({ rows = 3 }: { rows?: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const startedAt = Date.now()

    const timer = setInterval(() => {
      const next = Date.now() - startedAt
      setElapsed(next)

      // これ以上は表示が変わらないので、数えるのをやめる
      if (next >= STALLED_MS) clearInterval(timer)
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [])

  const notice = loadingNotice(elapsed)

  return (
    <div style={{ display: 'grid', gap: 16 }} aria-busy="true">
      <div style={{ display: 'grid', gap: 8 }}>
        <Skeleton width={180} height={26} />
        <Skeleton width={280} height={14} />
      </div>

      {Array.from({ length: rows }, (_, index) => (
        <Card key={index} style={{ display: 'grid', gap: 10 }}>
          <Skeleton width="45%" height={16} />
          <Skeleton width="80%" height={12} />
          <Skeleton width="60%" height={12} />
        </Card>
      ))}

      {/* 読み込みが長引いたときだけ出す */}
      <p
        role="status"
        aria-live="polite"
        style={{
          minHeight: '1.4em',
          fontSize: '0.82rem',
          color:
            elapsed >= STALLED_MS ? 'var(--color-danger)' : 'var(--color-fg-muted)',
        }}
      >
        {notice}
      </p>
    </div>
  )
}

export { SLOW_MS }
