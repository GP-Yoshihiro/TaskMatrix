import { redirect } from 'next/navigation'
import { isConnectivityFailure } from '@/lib/domain/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createServerSupabaseClient()

  // 認証サービスに到達できないときはログインへ送らない。
  // ログイン画面でも同じ理由で先へ進めず、行き止まりになるため。
  try {
    const { data, error } = await supabase.auth.getUser()
    if (isConnectivityFailure(error)) redirect('/offline')
    redirect(data.user ? '/dashboard' : '/login')
  } catch (error) {
    if (isConnectivityFailure(error as { message?: string; name?: string })) {
      redirect('/offline')
    }
    throw error
  }
}
