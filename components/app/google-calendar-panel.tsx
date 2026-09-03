'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  disconnectGoogleAction,
  pullCalendarAction,
  pushSchedulesAction,
} from '@/lib/actions/google-calendar'
import { callAction } from '@/lib/client/safe-action'

const muted = { color: 'var(--color-fg-muted)' }

/** 連携から戻ってきたときの結果。利用者に何が起きたかを日本語で伝える */
const RESULT_MESSAGE: Record<string, { text: string; isError: boolean }> = {
  connected: { text: 'Google カレンダーと連携しました。', isError: false },
  denied: { text: '連携が許可されませんでした。', isError: true },
  invalid_state: {
    text: '連携を確認できませんでした。お手数ですが、もう一度お試しください。',
    isError: true,
  },
  not_configured: { text: 'Google 連携の設定が不足しています。', isError: true },
  failed: {
    text: '連携に失敗しました。時間をおいてお試しください。',
    isError: true,
  },
}

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function GoogleCalendarPanel({
  projectId,
  connected,
  configured,
  lastSyncedAt,
  unsyncedCount,
  result,
}: {
  projectId: string
  connected: boolean
  /** 環境変数が揃っているか */
  configured: boolean
  lastSyncedAt: string | null
  /** まだ Google に書き出していない予定の数 */
  unsyncedCount: number
  /** 連携から戻ってきたときの結果 */
  result: string | null
}) {
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(
    result ? (RESULT_MESSAGE[result] ?? null) : null,
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function run(
    action: () => Promise<{ ok: boolean; data?: unknown; error?: { message: string } }>,
    onSuccess: (data: unknown) => string,
  ) {
    setMessage(null)
    startTransition(async () => {
      const result = await callAction(action as never)
      if (result.ok) {
        setMessage({ text: onSuccess(result.data), isError: false })
        router.refresh()
      } else {
        setMessage({ text: result.error.message, isError: true })
      }
    })
  }

  function handlePull() {
    const formData = new FormData()
    formData.set('projectId', projectId)

    run(
      () => pullCalendarAction(formData),
      (data) => {
        const updated = (data as { updated: number }).updated
        return updated === 0
          ? 'Google 側に変更はありませんでした。'
          : `Google 側の変更で ${updated} 件の予定を更新しました。`
      },
    )
  }

  function handlePush() {
    const formData = new FormData()
    formData.set('projectId', projectId)

    run(
      () => pushSchedulesAction(formData),
      (data) => {
        const { pushed, failed } = data as { pushed: number; failed: number }
        if (pushed === 0 && failed === 0) return '書き出す予定はありませんでした。'
        return failed > 0
          ? `${pushed} 件を書き出しました（${failed} 件は失敗したため次回に持ち越します）。`
          : `${pushed} 件の予定を Google カレンダーへ書き出しました。`
      },
    )
  }

  function handleDisconnect() {
    setConfirmOpen(false)
    run(() => disconnectGoogleAction(), () => '連携を解除しました。')
  }

  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <h2 className="tm-h2">Google カレンダー連携</h2>

      {!configured ? (
        <p role="alert" style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>
          Google 連携の設定（GOOGLE_CLIENT_ID など）が未設定のため利用できません。
        </p>
      ) : !connected ? (
        <>
          <p style={{ fontSize: '0.8rem', ...muted }}>
            確定した予定を Google カレンダーへ書き出せます。
            <strong>このアプリ専用のカレンダーを新しく作り、そこにだけ書き込みます。</strong>
            既存の予定を読んだり書き換えたりはしません。
          </p>
          <div>
            {/* Google の同意画面へ遷移するため、通常のリンクを使う */}
            <a
              href={`/api/google/connect?from=${encodeURIComponent(
                `/projects/${projectId}/schedule`,
              )}`}
              style={{
                display: 'inline-block',
                padding: '8px 14px',
                borderRadius: 8,
                background: 'var(--color-accent)',
                color: 'var(--color-accent-fg)',
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              Google カレンダーと連携
            </a>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: '0.85rem' }}>
            連携済み
            {lastSyncedAt && (
              <span style={{ ...muted }}>
                （最終取り込み {dateFormatter.format(new Date(lastSyncedAt))}）
              </span>
            )}
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" onClick={handlePull} disabled={isPending}>
              {isPending ? '処理中…' : 'Google の変更を取り込む'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePush}
              disabled={isPending || unsyncedCount === 0}
            >
              未書き出しの {unsyncedCount} 件を書き出す
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
            >
              連携を解除
            </Button>
          </div>

          <p style={{ fontSize: '0.78rem', ...muted }}>
            予定を確定すると自動で書き出します。Google 側で日時を動かした変更は、
            「取り込む」を押したときに反映されます。
          </p>

          {/* 黙って復活すると不可解に映るため、先に伝えておく */}
          <p style={{ fontSize: '0.78rem', ...muted }}>
            <strong>Google 側で予定を削除しても、TaskMatrix からは消えません。</strong>
            次の書き出しで作り直されます。予定を消すときは TaskMatrix 側で削除してください。
          </p>
        </>
      )}

      {message && (
        <p
          role={message.isError ? 'alert' : 'status'}
          style={{
            fontSize: '0.85rem',
            color: message.isError ? 'var(--color-danger)' : 'var(--color-fg-muted)',
          }}
        >
          {message.text}
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Google カレンダーの連携を解除しますか？"
        description="以後、予定の書き出しと取り込みは行われません。"
        warning="一度解除すると元に戻せません。再度使うには連携し直す必要があります。Google 側に作られたカレンダーと予定はそのまま残ります。"
        confirmLabel="解除する"
        pending={isPending}
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  )
}
