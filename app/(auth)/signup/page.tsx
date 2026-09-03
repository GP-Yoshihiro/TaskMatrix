import Link from 'next/link'
import { AuthForm } from '@/components/features/auth/auth-form'
import { Input } from '@/components/ui/input'
import { signUpAction } from '@/lib/actions/auth'

export default function SignupPage() {
  return (
    <AuthForm
      title="新規アカウント作成"
      submitLabel="アカウントを作成"
      action={signUpAction}
      redirectTo="/dashboard"
      extraFields={
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>招待コード</span>
          <Input name="inviteCode" autoComplete="off" required placeholder="inv_..." />
          <span style={{ fontSize: '0.78rem', color: 'var(--color-fg-muted)' }}>
            登録には招待コードが必要です。運用者からお受け取りください。
          </span>
        </label>
      }
      footer={
        <>
          すでにアカウントをお持ちの場合は <Link href="/login">ログイン</Link> へ。
          <br />
          登録により <Link href="/privacy">プライバシーポリシー</Link> に同意したものとみなします。
        </>
      }
    />
  )
}
