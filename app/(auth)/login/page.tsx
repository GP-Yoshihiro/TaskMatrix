import Link from 'next/link'
import { AuthForm } from '@/components/features/auth/auth-form'
import { signInAction } from '@/lib/actions/auth'

export default function LoginPage() {
  return (
    <AuthForm
      title="ログイン"
      submitLabel="ログイン"
      action={signInAction}
      redirectTo="/dashboard"
      footer={
        <>
          アカウントをお持ちでない場合は <Link href="/signup">新規登録</Link> へ。
          <br />
          <Link href="/privacy">プライバシーポリシー</Link>
        </>
      }
    />
  )
}
