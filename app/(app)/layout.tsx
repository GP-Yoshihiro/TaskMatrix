import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { createSupabaseProjectRepository } from '@/lib/repositories/projects'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // サイドバーからプロジェクトを切り替えられるよう、一覧をここで読む。
  // 読めなくても画面は出す（移動先が減るだけで、操作は続けられる）
  let projects: { id: string; name: string }[] = []
  try {
    projects = (await createSupabaseProjectRepository(supabase).listByOwner(user.id)).map(
      (project) => ({ id: project.id, name: project.name }),
    )
  } catch {
    projects = []
  }

  return <AppShell projects={projects}>{children}</AppShell>
}
