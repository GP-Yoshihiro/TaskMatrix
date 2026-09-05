'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { markLimitNoticesReadAction } from '@/lib/actions/limit-notifications'
import { callAction } from '@/lib/client/safe-action'
import { noticeMessage } from '@/lib/domain/limit-notification'
import type { LimitNotice } from '@/lib/repositories/limit-notifications'

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * 子が上限に達したことの知らせ。管理者にだけ出す。
 *
 * 費用を負担しているのは運用者であり、
 * 「誰が」「何の上限で」止まっているのかが分からないと手の打ちようがない。
 * 枠を増やす画面への導線もここに置く。
 */
export function LimitAlert({
  notices,
  planUrl,
}: {
  notices: LimitNotice[]
  /**
   * 利用枠を増やす画面。値として受け取る。
   *
   * URL に Google Cloud のプロジェクト ID が含まれるため、
   * ここで定数として持つと全利用者のブラウザへ配られてしまう。
   * 管理者向けに描くときにだけ渡す。
   */
  planUrl: string
}) {
  const [dismissed, setDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (dismissed || notices.length === 0) return null

  function handleDismiss() {
    startTransition(async () => {
      const result = await callAction(() => markLimitNoticesReadAction())
      if (result.ok) {
        setDismissed(true)
        router.refresh()
      }
    })
  }

  return (
    <Card
      style={{ display: 'grid', gap: 10, borderColor: 'var(--color-danger)' }}
      role="status"
    >
      <strong style={{ fontSize: '0.9rem', color: 'var(--color-danger)' }}>
        AI の利用上限に達した利用者がいます
      </strong>

      <ul
        style={{
          margin: 0,
          paddingLeft: '1.3em',
          listStyle: 'disc',
          fontSize: '0.85rem',
          lineHeight: 1.8,
        }}
      >
        {notices.map((notice) => (
          <li key={notice.id}>
            <strong>{notice.name}</strong> — {noticeMessage(notice.reason)}
            <span style={{ color: 'var(--color-fg-muted)' }}>
              （{dateFormatter.format(new Date(notice.createdAt))}）
            </span>
          </li>
        ))}
      </ul>

      <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)', lineHeight: 1.7 }}>
        日本時間の 0 時を過ぎれば、その方はまた使えるようになります。
        待たずに使えるようにするには、利用枠を増やしてください。
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <a
          href={planUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.85rem', fontWeight: 600 }}
        >
          利用枠を増やす（Google AI Studio）↗
        </a>
        <Button size="sm" variant="secondary" onClick={handleDismiss} disabled={isPending}>
          {isPending ? '処理中…' : '確認しました'}
        </Button>
      </div>
    </Card>
  )
}
