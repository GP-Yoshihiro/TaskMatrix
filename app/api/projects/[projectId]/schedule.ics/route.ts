import { type NextRequest, NextResponse } from 'next/server'
import { buildIcs } from '@/lib/domain/ics'
import { createSupabaseScheduleRepository } from '@/lib/repositories/schedules'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * 確定済みスケジュールを .ics で書き出す。
 *
 * Server Action ではなく Route Handler にしているのは、
 * ダウンロードに Content-Disposition ヘッダーが必要なため。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new NextResponse('ログインが必要です。', { status: 401 })
  }

  // 他人のプロジェクトなら RLS により 0 件になる
  const schedules = await createSupabaseScheduleRepository(supabase).listByProject(projectId)

  const ics = buildIcs(
    schedules.map((schedule) => ({
      uid: `${schedule.id}@taskmatrix`,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      summary: schedule.taskTitle,
      description: schedule.reason,
    })),
  )

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="taskmatrix.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
