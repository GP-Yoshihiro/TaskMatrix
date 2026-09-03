'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { issueInvitationAction, revokeInvitationAction } from '@/lib/actions/invitations'
import { callAction } from '@/lib/client/safe-action'
import { DEFAULT_EXPIRY_DAYS, invitationStatus } from '@/lib/domain/invitation'
import type { Invitation } from '@/lib/repositories/invitations'

const muted = { color: 'var(--color-fg-muted)' }

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value))
}

const STATUS_LABEL = {
  active: '有効',
  used: '使用済み',
  revoked: '無効化済み',
  expired: '期限切れ',
} as const

/**
 * 招待コードの発行・一覧・無効化。
 *
 * 発行直後の 1 回だけ全文を表示する。保存されるのはハッシュのみで、
 * 以降どこからも平文を取り出せない。紛失時は無効化して再発行する。
 */
export function InvitationPanel({ invitations }: { invitations: Invitation[] }) {
  const [note, setNote] = useState('')
  const [issued, setIssued] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const now = new Date()

  function handleIssue() {
    setMessage(null)
    setIssued(null)

    const formData = new FormData()
    formData.set('note', note.trim())

    startTransition(async () => {
      const result = await callAction(() => issueInvitationAction(formData))
      if (result.ok) {
        setIssued(result.data.code)
        setNote('')
        router.refresh()
      } else {
        setMessage({ text: result.error.message, isError: true })
      }
    })
  }

  function handleRevoke(id: string) {
    setMessage(null)

    const formData = new FormData()
    formData.set('id', id)

    startTransition(async () => {
      const result = await callAction(() => revokeInvitationAction(formData))
      if (result.ok) {
        setMessage({ text: '無効にしました。', isError: false })
        router.refresh()
      } else {
        setMessage({ text: result.error.message, isError: true })
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={{ display: 'grid', gap: 8 }}>
        <h2 className="tm-h2">コードを発行する</h2>
        <p style={{ ...muted, fontSize: '0.82rem' }}>
          1 つのコードで 1 人だけ登録できます。有効期限は発行から {DEFAULT_EXPIRY_DAYS} 日です。
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'grid', gap: 4, flex: '1 1 220px' }}>
            <span style={{ ...muted, fontSize: '0.82rem' }}>渡す相手のメモ（任意）</span>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="例: 営業部 田中さん"
              disabled={isPending}
            />
          </label>
          <Button onClick={handleIssue} disabled={isPending}>
            {isPending ? '処理中…' : '発行する'}
          </Button>
        </div>

        {issued && (
          <Card style={{ display: 'grid', gap: 6, borderColor: 'var(--color-accent)' }}>
            <strong style={{ fontSize: '0.88rem' }}>
              このコードを表示できるのは、今この 1 回だけです。
            </strong>
            <code
              style={{
                fontSize: '0.95rem',
                wordBreak: 'break-all',
                userSelect: 'all',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-subtle)',
              }}
            >
              {issued}
            </code>
            <span style={{ ...muted, fontSize: '0.8rem' }}>
              保存しているのはハッシュのみで、あとから読み返せません。
              紛失した場合は無効にして発行し直してください。
            </span>
          </Card>
        )}

        {message && (
          <p
            role="alert"
            style={{
              fontSize: '0.82rem',
              color: message.isError ? 'var(--color-danger)' : 'var(--color-fg-muted)',
            }}
          >
            {message.text}
          </p>
        )}
      </section>

      <section style={{ display: 'grid', gap: 8 }}>
        <h2 className="tm-h2">発行したコード</h2>
        {invitations.length === 0 ? (
          <p style={{ ...muted, fontSize: '0.85rem' }}>まだ発行していません。</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {invitations.map((invitation) => {
              const status = invitationStatus(
                {
                  usedAt: invitation.usedAt,
                  revokedAt: invitation.revokedAt,
                  expiresAt: invitation.expiresAt,
                },
                now,
              )

              return (
                <Card
                  key={invitation.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <code style={{ fontSize: '0.88rem' }}>{invitation.displayPrefix}</code>
                    <span style={{ ...muted, fontSize: '0.8rem' }}>
                      {invitation.note || 'メモなし'}
                      {' ・ '}
                      {STATUS_LABEL[status]}
                      {status === 'active' && `（${formatDate(invitation.expiresAt)} まで）`}
                      {status === 'used' &&
                        invitation.usedAt &&
                        `（${formatDate(invitation.usedAt)}）`}
                    </span>
                  </div>
                  {status === 'active' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleRevoke(invitation.id)}
                      disabled={isPending}
                    >
                      無効にする
                    </Button>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
