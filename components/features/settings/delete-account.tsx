'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteAccountAction } from '@/lib/actions/account'
import { callAction } from '@/lib/client/safe-action'
import { DELETION_NOTICE, matchesConfirmation } from '@/lib/domain/account'

/**
 * アカウントの削除。
 *
 * 取り消せない操作のため、確認ダイアログではなく
 * **自分のメールアドレスを打たせる**方式にしている。
 * 「はい」を押すだけだと、流れで実行してしまう。
 */
export function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const canDelete = matchesConfirmation(confirmation, email)

  function handleDelete() {
    if (!canDelete) return

    setMessage(null)
    const formData = new FormData()
    formData.set('confirmation', confirmation)

    startTransition(async () => {
      const result = await callAction(() => deleteAccountAction(formData))

      if (result.ok) {
        // 消えたアカウントの画面に留まらせない
        router.replace('/login')
        router.refresh()
      } else {
        setMessage(result.error.message)
      }
    })
  }

  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <h2 className="tm-h2" style={{ color: 'var(--color-danger)' }}>
        アカウントの削除
      </h2>

      {!open ? (
        <>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
            アカウントと、保存しているすべてのデータを削除します。
          </p>
          <div>
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              アカウントを削除する
            </Button>
          </div>
        </>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 10,
            padding: 14,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-danger)',
          }}
        >
          <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-danger)' }}>
            この操作は取り消せません。
          </p>

          <ul
            style={{
              margin: 0,
              paddingLeft: '1.3em',
              listStyle: 'disc',
              fontSize: '0.82rem',
              lineHeight: 1.8,
            }}
          >
            {DELETION_NOTICE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem' }}>
            続けるには、ご自身のメールアドレス <strong>{email}</strong> を入力してください。
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={email}
              aria-label="確認のためのメールアドレス"
              autoComplete="off"
              disabled={isPending}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="danger"
              onClick={handleDelete}
              disabled={isPending || !canDelete}
            >
              {isPending ? '削除中…' : '完全に削除する'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setOpen(false)
                setConfirmation('')
                setMessage(null)
              }}
              disabled={isPending}
            >
              やめる
            </Button>
          </div>

          {message && (
            <p role="alert" style={{ fontSize: '0.82rem', color: 'var(--color-danger)' }}>
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
