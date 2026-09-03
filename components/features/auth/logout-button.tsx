'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { signOutAction } from '@/lib/actions/auth'

/**
 * ログアウト。
 *
 * 押し間違いで作業中の画面から出てしまわないよう、確認ダイアログを挟む。
 */
export function LogoutButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      await signOutAction()
    })
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        ログアウト
      </Button>

      <ConfirmDialog
        open={open}
        title="ログアウトしますか？"
        description="現在のセッションを終了します。再度ご利用いただくにはログインが必要です。"
        confirmLabel="ログアウト"
        confirmVariant="primary"
        pending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
