'use client'

import { useEffect, useState } from 'react'
import {
  PROGRESS_CAP,
  computeProgress,
  formatDuration,
  formatEstimate,
} from '@/lib/domain/usage'

/** 表示の更新間隔。秒の小数第 1 位まで動かすため 100ms とする */
const TICK_MS = 100

type Props = {
  pending: boolean
  estimateMs: number
  /** 実績にもとづく予測か。false のときは目安であることを示す */
  isMeasured: boolean
}

/**
 * AI 処理中の経過時間と予測時間。
 *
 * 処理中だけ中身をマウントする。こうすると計測の状態が毎回まっさらから始まり、
 * 前回の経過時間が一瞬残ることも、描画中に時刻を読むこともない。
 */
export function AiProgress({ pending, estimateMs, isMeasured }: Props) {
  if (!pending) return null

  return <RunningProgress estimateMs={estimateMs} isMeasured={isMeasured} />
}

function RunningProgress({ estimateMs, isMeasured }: Omit<Props, 'pending'>) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const startedAt = Date.now()
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), TICK_MS)

    // 処理が終わるとこの部品ごと外れ、タイマーも必ず止まる
    return () => clearInterval(timer)
  }, [])

  const progress = computeProgress(elapsedMs, estimateMs)
  const overrun = progress === null

  return (
    <div role="status" aria-live="polite" style={{ display: 'grid', gap: 6 }}>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
        {overrun
          ? `予測を超えています（${formatDuration(elapsedMs)}経過）`
          : `処理中… ${formatDuration(elapsedMs)}経過 ／ 予測 ${formatEstimate(estimateMs)}${
              isMeasured ? '' : '（目安）'
            }`}
      </p>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          overflow: 'hidden',
          background: 'var(--color-border)',
        }}
      >
        <div
          data-testid="ai-progress-bar"
          style={{
            height: '100%',
            width: overrun ? '100%' : `${(progress ?? 0) * 100}%`,
            background: 'var(--color-accent)',
            opacity: overrun ? 0.4 : 1,
            transition: 'width 0.1s linear',
          }}
        />
      </div>
    </div>
  )
}

export { PROGRESS_CAP }
