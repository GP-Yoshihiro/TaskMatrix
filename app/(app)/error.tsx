'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
      <h2 style={{ fontWeight: 600 }}>問題が発生しました</h2>
      <p style={{ color: 'var(--color-fg-muted)', fontSize: '0.9rem' }}>
        処理を完了できませんでした。時間をおいて再度お試しください。
      </p>
      <div>
        <Button onClick={reset}>再試行</Button>
      </div>
    </Card>
  )
}
