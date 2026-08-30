import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { LogoutButton } from '@/components/app/logout-button'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: 'calc(var(--space-unit) * 3) calc(var(--space-unit) * 5)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link href="/dashboard" style={{ fontWeight: 600 }}>
            TaskMatrix
          </Link>
          <Link href="/projects">プロジェクト</Link>
          <Link href="/settings">設定</Link>
        </nav>
        <LogoutButton />
      </header>
      <main style={{ padding: 'calc(var(--space-unit) * 6)' }}>{children}</main>
    </div>
  )
}
