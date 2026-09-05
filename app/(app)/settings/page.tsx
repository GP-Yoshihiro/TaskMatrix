import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { DeleteAccount } from '@/components/features/settings/delete-account'
import { DisplayNameForm } from '@/components/features/settings/display-name-form'
import { ThemeSwitcher } from '@/components/features/settings/theme-switcher'
import { WorkSettingsForm } from '@/components/features/settings/work-settings-form'
import { formatUsage } from '@/lib/domain/capacity'
import { DEFAULT_WORK_SETTINGS } from '@/lib/domain/schedule'
import { createSupabaseWorkSettingsRepository } from '@/lib/repositories/work-settings'
import type { ThemePreference } from '@/lib/platform/theme'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getCurrentUser()

  if (!user) redirect('/login')

  // 互いに依存しない 3 つの取得。順に待つと待ち時間が足し算になる
  const [profileResult, storedSettings, usage] = await Promise.all([
    supabase
      .from('profiles')
      .select('theme, email, display_name, is_admin')
      .eq('id', user.id)
      .maybeSingle(),
    createSupabaseWorkSettingsRepository(supabase).find(user.id),
    // 読めなくても設定画面は出す（表示は補助的な情報のため）
    (async (): Promise<string | null> => {
      try {
        const { data } = await supabase.rpc('database_size_bytes')
        return formatUsage(Number(data ?? 0))
      } catch {
        return null
      }
    })(),
  ])

  const profile = profileResult.data
  const current = (profile?.theme ?? 'auto') as ThemePreference

  // 未設定の利用者には既定値を表示する
  const workSettings = storedSettings ?? DEFAULT_WORK_SETTINGS

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 680 }}>
      <PageHeader title="設定" description="表示名・テーマ・稼働条件と、使用量の確認です。" />
      <section style={{ display: 'grid', gap: 8 }}>
        <h2 className="tm-h2">アカウント</h2>
        <p style={{ color: 'var(--color-fg-muted)' }}>{profile?.email}</p>
      </section>
      <section style={{ display: 'grid', gap: 8 }}>
        <h2 className="tm-h2">表示名</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
          変更履歴に表示される名前です。未登録のときはメールアドレスの @ より前を使います。
        </p>
        <DisplayNameForm current={profile?.display_name ?? ''} />
      </section>
      <section style={{ display: 'grid', gap: 8 }}>
        <h2 className="tm-h2">表示テーマ</h2>
        <ThemeSwitcher current={current} />
      </section>
      {usage && (
        <section style={{ display: 'grid', gap: 8 }}>
          <h2 className="tm-h2">データベースの使用量</h2>
          <p style={{ fontSize: '0.95rem' }}>{usage}</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
            変更履歴は期限では消えません。上限に近づいたときだけ、
            ロック付きのタグが付いたファイルを除いて古い順に整理します。
          </p>
        </section>
      )}
      <section style={{ display: 'grid', gap: 8 }}>
        <h2 className="tm-h2">AI の使用量</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
          これまでに使ったトークン量と、処理にかかった時間を確認できます。
        </p>
        <Link href="/settings/usage">使用量の履歴を見る</Link>
      </section>
      {profile?.is_admin && (
        <section style={{ display: 'grid', gap: 8 }}>
          <h2 className="tm-h2">招待コード</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
            登録できる人を、コードを渡した相手だけに限ります。
          </p>
          <Link href="/settings/invitations">招待コードを発行する</Link>
        </section>
      )}
      <section style={{ display: 'grid', gap: 8 }}>
        <h2 className="tm-h2">稼働条件</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
          AI がスケジュールを算出する際に、この条件の範囲内に予定を割り当てます。
        </p>
        <WorkSettingsForm settings={workSettings} />
      </section>
      {profile?.email && <DeleteAccount email={profile.email} />}
    </div>
  )
}
