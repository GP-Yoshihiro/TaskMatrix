import Link from 'next/link'
import { AuthForm } from '@/components/features/auth/auth-form'
import { signUpAction } from '@/lib/actions/auth'

export default function SignupPage() {
  return (
    <AuthForm
      title="新規アカウント作成"
      submitLabel="アカウントを作成"
      action={signUpAction}
      redirectTo="/dashboard"
      footer={
        <>
          すでにアカウントをお持ちの場合は <Link href="/login">ログイン</Link> へ。
        </>
      }
    />
  )
}
