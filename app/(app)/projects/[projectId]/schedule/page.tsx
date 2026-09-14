import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { GoogleCalendarPanel } from '@/components/features/schedule/google-calendar-panel'
import { SchedulePlanner } from '@/components/features/schedule/schedule-planner'
import { hasAssignee, resolveAssignee } from '@/lib/domain/assignee'
import { DEFAULT_WORK_SETTINGS } from '@/lib/domain/schedule'
import { createSupabaseAiUsageRepository } from '@/lib/repositories/ai-usage'
import { createSupabaseGoogleConnectionRepository } from '@/lib/repositories/google-connections'
import { createSupabaseMemberRepository } from '@/lib/repositories/members'
import { createSupabaseScheduleRepository } from '@/lib/repositories/schedules'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'
import { createSupabaseWorkSettingsRepository } from '@/lib/repositories/work-settings'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { loadEstimate } from '@/lib/usecases/load-estimate'

/** AI の算出は 20 秒以上かかることがあるため、実行時間の上限を延ばす */
export const maxDuration = 120

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ google?: string }>
}) {
  const { projectId } = await params
  const { google } = await searchParams
  const supabase = await createServerSupabaseClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) notFound()

  const user = await getCurrentUser()

  const [tasks, confirmed, savedSettings, members] = await Promise.all([
    createSupabaseTaskRepository(supabase).listByProject(projectId),
    createSupabaseScheduleRepository(supabase).listByProject(projectId),
    user ? createSupabaseWorkSettingsRepository(supabase).find(user.id) : null,
    // 名簿が読めなくても予定は出す。区切りが使えないだけで、操作は続けられる
    createSupabaseMemberRepository(supabase)
      .listMembers(projectId)
      .catch(() => []),
  ])

  const settings = savedSettings ?? DEFAULT_WORK_SETTINGS

  const pendingTaskCount = tasks.filter((task) => task.status !== 'done').length

  // 担当名から所属セクションを引く表。**先頭が「最初の所属」**になる。
  // 複属の人はそこにだけ出し、他の所属は名前を押したときに見せる
  const sectionsByAssignee = Object.fromEntries(
    members.map((member) => [member.name, member.sections.map((section) => section.name)]),
  )

  // ガントチャートの色分けに使う。予定は担当を持たないため、タスクから引く。
  // 名簿のメンバーが選ばれていればその名前、無ければ自由入力の文字
  const assigneeByTaskId = Object.fromEntries(
    tasks.map((task) => [
      task.id,
      hasAssignee({ memberName: task.assigneeMemberName, freeText: task.assignee })
        ? resolveAssignee({
            memberName: task.assigneeMemberName,
            freeText: task.assignee,
          })
        : '',
    ]),
  )

  const estimate = await loadEstimate(
    createSupabaseAiUsageRepository(supabase),
    'plan_schedule',
  )

  const connection = user
    ? await createSupabaseGoogleConnectionRepository(supabase).find(user.id)
    : null
  const unsynced = await createSupabaseScheduleRepository(supabase).listUnsynced(projectId)

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageHeader
        projectId={projectId}
        projectName={project.name}
        pageLabel="予定"
        title="スケジュール"
        description="未完了のタスクから予定を算出し、確定するとカレンダーに反映されます。"
      />
      <SchedulePlanner
        assigneeByTaskId={assigneeByTaskId}
        sectionsByAssignee={sectionsByAssignee}
        projectId={projectId}
        confirmed={confirmed}
        pendingTaskCount={pendingTaskCount}
        settings={settings}
        estimate={estimate}
      />
      <GoogleCalendarPanel
        projectId={projectId}
        connected={connection !== null}
        configured={Boolean(
          process.env.GOOGLE_CLIENT_ID &&
            process.env.GOOGLE_CLIENT_SECRET &&
            process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
        )}
        lastSyncedAt={connection?.lastSyncedAt ?? null}
        needsReconnect={connection?.needsReconnect ?? false}
        unsyncedCount={unsynced.length}
        result={google ?? null}
      />
    </div>
  )
}
