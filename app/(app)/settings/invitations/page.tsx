import { notFound, redirect } from 'next/navigation'
import { InvitationPanel } from '@/components/features/settings/invitation-panel'
import { PageHeader } from '@/components/layout/page-header'
import { createSupabaseInvitationRepository } from '@/lib/repositories/invitations'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revealInvitations } from '@/lib/usecases/reveal-invitations'

/**
 * 招待コードの発行画面。管理者のみ。
 *
 * 管理者でないときは 404 にする。403 を返すと、
 * 「その画面が存在する」ことだけは伝わってしまうため。
 */
export default async function InvitationsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) notFound()

  const stored = await createSupabaseInvitationRepository(supabase).listByCreator(user.id)

  // 暗号化した本体は画面へ渡さない。復号した結果だけを渡す
  const invitations = revealInvitations(stored, process.env.GOOGLE_TOKEN_ENCRYPTION_KEY)

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 680 }}>
      <PageHeader
        title="招待コード"
        description="登録できる人を、コードを渡した相手だけに限ります。"
      />
      <InvitationPanel invitations={invitations} />
    </div>
  )
}
