'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { PasswordGate } from '@/components/features/settings/password-gate'
import {
  issueInvitationAction,
  revealInvitationCodesAction,
  revokeInvitationAction,
} from '@/lib/actions/invitations'
import { callAction } from '@/lib/client/safe-action'
import { DEFAULT_EXPIRY_DAYS, invitationStatus } from '@/lib/domain/invitation'
import type { InvitationSummary } from '@/lib/usecases/reveal-invitations'

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
export function InvitationPanel({ invitations }: { invitations: InvitationSummary[] }) {
  const [note, setNote] = useState('')
  const [issued, setIssued] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  /** 復号したコード。null のあいだは施錠中 */
  const [codes, setCodes] = useState<Record<string, string | null> | null>(null)
  /** 確認が済んだら行う操作。確認のあとに繋げるために覚えておく */
  const [pending, setPending] = useState<{ kind: 'issue' } | { kind: 'open'; id: string } | null>(
    null,
  )
  const [asking, setAsking] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const now = new Date()
  const unlocked = codes !== null

  /**
   * 施錠中なら確認を挟む。
   *
   * 画面側で止めるのは操作の入口を揃えるためで、守っているのはサーバー側。
   * ここを迂回して呼ばれても、行為そのものが拒否される。
   */
  function guard(intent: { kind: 'issue' } | { kind: 'open'; id: string }): boolean {
    if (unlocked) return true

    setMessage(null)
    setPending(intent)
    setAsking(true)
    return false
  }

  /** 確認が通ったら、コードを読み出してから待たせていた操作を続ける */
  function handleUnlocked() {
    setAsking(false)

    startTransition(async () => {
      const result = await callAction(() => revealInvitationCodesAction())
      if (!result.ok) {
        setMessage({ text: result.error.message, isError: true })
        return
      }

      setCodes(Object.fromEntries(result.data.map((item) => [item.id, item.code])))

      if (pending?.kind === 'open') setOpenId(pending.id)
      // 発行はその場では続けない。押した意図の確認から時間が空くため
      if (pending?.kind === 'issue') {
        setMessage({ text: '確認できました。発行するボタンを押してください。', isError: false })
      }
      setPending(null)
    })
  }

  function handleIssue() {
    if (!guard({ kind: 'issue' })) return

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

        // 手元の一覧にも反映する。取り直さないと、発行したばかりの行だけ
        // 「読み返せません」と出てしまう
        const reloaded = await callAction(() => revealInvitationCodesAction())
        if (reloaded.ok) {
          setCodes(Object.fromEntries(reloaded.data.map((item) => [item.id, item.code])))
        }
      } else {
        setMessage({ text: result.error.message, isError: true })
      }
    })
  }

  function handleRevoke(id: string) {
    if (!guard({ kind: 'open', id })) return

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
      {asking && (
        <PasswordGate
          onUnlocked={handleUnlocked}
          onCancel={() => {
            setAsking(false)
            setPending(null)
          }}
        />
      )}

      {!unlocked && !asking && (
        <p style={{ ...muted, fontSize: '0.82rem' }}>
          発行・コピー・詳細の表示には、パスワードの確認が必要です。
        </p>
      )}

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
                      onClick={() => {
                        if (isOpen) {
                          setOpenId(null)
                          return
                        }
                        if (!guard({ kind: 'open', id: invitation.id })) return
                        setOpenId(invitation.id)
                      }}
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
                        <CodeRow code={codes?.[invitation.id] ?? null} />

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
