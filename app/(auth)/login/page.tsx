import Link from 'next/link'
import { AuthForm } from '@/components/app/auth-form'
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
        </>
      }
    />
  )
}
