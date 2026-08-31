import { redirect } from 'next/navigation'
import { ThemeSwitcher } from '@/components/app/theme-switcher'
import { WorkSettingsForm } from '@/components/app/work-settings-form'
import { DEFAULT_WORK_SETTINGS } from '@/lib/domain/schedule'
import { createSupabaseWorkSettingsRepository } from '@/lib/repositories/work-settings'
import type { ThemePreference } from '@/lib/platform/theme'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('theme, email')
    .eq('id', user.id)
    .maybeSingle()

  const current = (profile?.theme ?? 'auto') as ThemePreference

  // 未設定の利用者には既定値を表示する
  const workSettings =
    (await createSupabaseWorkSettingsRepository(supabase).find(user.id)) ??
    DEFAULT_WORK_SETTINGS

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 640 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>設定</h1>
      <section style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ fontWeight: 600 }}>アカウント</h2>
        <p style={{ color: 'var(--color-fg-muted)' }}>{profile?.email}</p>
      </section>
      <section style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ fontWeight: 600 }}>表示テーマ</h2>
        <ThemeSwitcher current={current} />
      </section>
      <section style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ fontWeight: 600 }}>稼働条件</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-fg-muted)' }}>
          AI がスケジュールを算出する際に、この条件の範囲内に予定を割り当てます。
        </p>
        <WorkSettingsForm settings={workSettings} />
      </section>
    </div>
  )
}
