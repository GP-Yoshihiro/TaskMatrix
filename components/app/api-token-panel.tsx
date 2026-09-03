'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { issueApiTokenAction, revokeApiTokenAction } from '@/lib/actions/api-tokens'
import { callAction } from '@/lib/client/safe-action'
import type { ApiToken } from '@/lib/repositories/api-tokens'

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
  return value ? dateFormatter.format(new Date(value)) : '未使用'
}

export function ApiTokenPanel({
  projectId,
  tokens,
  origin,
  configured,
}: {
  projectId: string
  tokens: ApiToken[]
  /** ショートカットに貼り付ける URL を組み立てるための起点 */
  origin: string
  /** サーバー専用キーが設定されているか。未設定なら API は動かない */
  configured: boolean
}) {
  const [name, setName] = useState('')
  const [issued, setIssued] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [target, setTarget] = useState<ApiToken | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleIssue() {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setMessage({ text: 'トークンの名前を入力してください。', isError: true })
      return
    }

    setMessage(null)
    setIssued(null)

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('name', trimmed)

    startTransition(async () => {
      const result = await callAction(() => issueApiTokenAction(formData))
      if (result.ok) {
        setIssued(result.data.token)
        setName('')
        router.refresh()
      } else {
        setMessage({ text: result.error.message, isError: true })
      }
    })
  }

  function handleRevoke() {
    if (!target) return

    const formData = new FormData()
    formData.set('projectId', projectId)
    formData.set('tokenId', target.id)

    startTransition(async () => {
      const result = await callAction(() => revokeApiTokenAction(formData))
      setTarget(null)

      if (result.ok) {
        setMessage({ text: 'トークンを失効しました。', isError: false })
        router.refresh()
      } else {
        setMessage({ text: result.error.message, isError: true })
      }
    })
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 className="tm-h2">連携トークン（iOS ショートカット）</h2>

      <p style={{ fontSize: '0.8rem', ...muted }}>
        iPhone のショートカットや Siri から、このプロジェクトにタスクを追加したり、
        今日やることを読み上げたりできます。トークンは
        <strong>このプロジェクトだけ</strong>に有効です。
      </p>

      {!configured && (
        <p role="alert" style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>
          サーバーの設定（SUPABASE_SERVICE_ROLE_KEY）が未設定のため、
          発行したトークンはまだ使えません。
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例: iPhone のショートカット"
          aria-label="トークンの名前"
          disabled={isPending}
        />
        <Button onClick={handleIssue} disabled={isPending}>
          {isPending ? '処理中…' : 'トークンを発行'}
        </Button>
      </div>

      {issued && (
        <Card style={{ display: 'grid', gap: 8 }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            この画面を離れると二度と表示できません。いまコピーしてください。
          </p>
          <code
            style={{
              fontSize: '0.82rem',
              wordBreak: 'break-all',
              padding: '8px 10px',
              borderRadius: 6,
              background: 'var(--color-bg)',
            }}
          >
            {issued}
          </code>

          <details style={{ fontSize: '0.8rem' }}>
            <summary style={{ cursor: 'pointer', ...muted }}>
              ショートカットでの使い方
            </summary>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              <p>
                ショートカットの「URL の内容を取得」で、次のように設定します。
                ヘッダーに <code>Authorization</code> を追加し、値を
                <code> Bearer （上のトークン）</code> にします。
              </p>
              <p style={{ ...muted }}>タスクを追加（方法: POST、本文: JSON）</p>
              <code style={{ wordBreak: 'break-all' }}>{origin}/api/v1/tasks</code>
              <p style={{ ...muted }}>
                本文に <code>{'{ "title": "タスク名" }'}</code> を入れます。
              </p>
              <p style={{ ...muted }}>今日やることを取得（方法: GET）</p>
              <code style={{ wordBreak: 'break-all' }}>{origin}/api/v1/tasks/today</code>
              <p style={{ ...muted }}>
                応答の <code>summary</code> を「テキストを読み上げる」に渡すと、
                そのまま件数を読み上げられます。
              </p>
            </div>
          </details>
        </Card>
      )}

      {tokens.length === 0 ? (
        <p style={{ fontSize: '0.85rem', ...muted }}>
          発行済みのトークンはありません。
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {tokens.map((token) => (
            <li
              key={token.id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
                fontSize: '0.85rem',
              }}
            >
              <strong>{token.name}</strong>
              <code style={{ ...muted }}>{token.displayPrefix}</code>
              <span style={{ ...muted }}>最終利用 {formatDate(token.lastUsedAt)}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setTarget(token)}
                disabled={isPending}
              >
                失効
              </Button>
            </li>
          ))}
        </ul>
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
        open={target !== null}
        title="このトークンを失効しますか？"
        description={target ? `「${target.name}」が使えなくなります。` : undefined}
        warning="一度失効すると元に戻せません。使用中のショートカットは動かなくなります。"
        confirmLabel="失効する"
        pending={isPending}
        onConfirm={handleRevoke}
        onCancel={() => setTarget(null)}
      />
    </section>
  )
}
