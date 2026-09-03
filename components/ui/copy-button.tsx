'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

/** 結果表示を元に戻すまでの時間 */
const RESET_MS = 2000

type Status = 'idle' | 'copied' | 'failed'

const LABEL: Record<Status, string> = {
  idle: 'コピー',
  copied: 'コピーしました',
  failed: 'コピーできません',
}

/**
 * 値をクリップボードへ写す。
 *
 * 結果を必ず表示する。押しただけでは写ったか分からず、
 * 失敗に気付かないまま相手へ空の内容を送ってしまうため。
 */
export function CopyButton({ value, size = 'sm' }: { value: string; size?: 'sm' | 'md' }) {
  const [status, setStatus] = useState<Status>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 表示を戻す前に画面から消えた場合に備える
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function reset() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus('idle'), RESET_MS)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setStatus('copied')
    } catch {
      // 安全でない接続や許可されていない場合はここに来る
      setStatus('failed')
    }
    reset()
  }

  return (
    <Button
      size={size}
      variant="secondary"
      onClick={handleCopy}
      aria-label={`${LABEL[status]}: ${value}`}
    >
      {LABEL[status]}
    </Button>
  )
}
