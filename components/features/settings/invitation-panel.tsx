'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { issueInvitationAction, revokeInvitationAction } from '@/lib/actions/invitations'
import { callAction } from '@/lib/client/safe-action'
import { DEFAULT_EXPIRY_DAYS, invitationStatus } from '@/lib/domain/invitation'
import type { RevealedInvitation } from '@/lib/usecases/reveal-invitations'

const muted = { color: 'var(--color-fg-muted)' }

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : '—'
}

const STATUS_LABEL = {
  active: '有効',
  used: '使用済み',
  revoked: '無効化済み',
  expired: '期限切れ',
} as const

const codeStyle = {
  fontSize: '0.95rem',
  wordBreak: 'break-all',
  userSelect: 'all',
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-bg-subtle)',
} as const

/** コードとコピーボタンの組。発行直後と一覧の詳細で同じ見た目にする */
function CodeRow({ code }: { code: string | null }) {
  if (!code) {
    return (
      <p style={{ ...muted, fontSize: '0.8rem' }}>
        このコードは読み返せません。控えが無い場合は、無効にして発行し直してください。
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <code style={{ ...codeStyle, flex: '1 1 240px' }}>{code}</code>
      <CopyButton value={code} />
    </div>
  )
}

/**
 * 招待コードの発行・一覧・無効化。
 *
 * コードは暗号化して保存しており、管理者は後から読み返せる。
 * 一覧では既定で伏せ、押した行だけ開く。常に全件を並べると、
 * 画面を開いたままにしているときに背後から読まれる面が広がるため。
 */
export function InvitationPanel({ invitations }: { invitations: RevealedInvitation[] }) {
  const [note, setNote] = useState('')
  const [issued, setIssued] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
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
          <Card style={{ display: 'grid', gap: 8, borderColor: 'var(--color-accent)' }}>
            <strong style={{ fontSize: '0.88rem' }}>発行しました</strong>
            <CodeRow code={issued} />
            <span style={{ ...muted, fontSize: '0.8rem' }}>
              このコードは下の一覧からも読み返せます。
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
          <>
            <p style={{ ...muted, fontSize: '0.82rem' }}>
              行を押すと、コードの全文と詳細が開きます。
            </p>
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
                const isOpen = openId === invitation.id

                return (
                  <Card key={invitation.id} style={{ display: 'grid', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : invitation.id)}
                      aria-expanded={isOpen}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'inherit',
                        font: 'inherit',
                      }}
                    >
                      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                        <code style={{ fontSize: '0.88rem' }}>{invitation.displayPrefix}</code>
                        <span style={{ ...muted, fontSize: '0.8rem' }}>
                          {invitation.note || 'メモなし'}
                          {' ・ '}
                          {STATUS_LABEL[status]}
                        </span>
                      </span>
                      <span aria-hidden="true" style={{ ...muted, fontSize: '0.8rem' }}>
                        {isOpen ? '閉じる ▲' : '詳細 ▼'}
                      </span>
                    </button>

                    {isOpen && (
                      <div
                        style={{
                          display: 'grid',
                          gap: 10,
                          paddingTop: 10,
                          borderTop: '1px solid var(--color-border)',
                        }}
                      >
                        <CodeRow code={invitation.code} />

                        <dl
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr',
                            gap: '4px 12px',
                            margin: 0,
                            fontSize: '0.82rem',
                          }}
                        >
                          <dt style={muted}>メモ</dt>
                          <dd style={{ margin: 0 }}>{invitation.note || '—'}</dd>
                          <dt style={muted}>状態</dt>
                          <dd style={{ margin: 0 }}>{STATUS_LABEL[status]}</dd>
                          <dt style={muted}>発行</dt>
                          <dd style={{ margin: 0 }}>{formatDate(invitation.createdAt)}</dd>
                          <dt style={muted}>期限</dt>
                          <dd style={{ margin: 0 }}>{formatDate(invitation.expiresAt)}</dd>
                          <dt style={muted}>使用</dt>
                          <dd style={{ margin: 0 }}>{formatDate(invitation.usedAt)}</dd>
                        </dl>

                        {status === 'active' && (
                          <div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleRevoke(invitation.id)}
                              disabled={isPending}
                            >
                              無効にする
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
