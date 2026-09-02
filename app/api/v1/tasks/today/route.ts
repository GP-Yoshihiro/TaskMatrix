import type { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/api/authenticate'
import { apiError, apiOk } from '@/lib/api/respond'
import { selectTodayTasks } from '@/lib/domain/today'
import { createSupabaseScheduleRepository } from '@/lib/repositories/schedules'
import { createSupabaseTaskRepository } from '@/lib/repositories/tasks'

/** 稼働条件のタイムゾーンではなく、日本時間で「今日」を決める */
function todayInJst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** ショートカットでそのまま読み上げに使える 1 行 */
function buildSummary(count: number): string {
  if (count === 0) return '今日のタスクはありません。'
  return `今日のタスクは ${count} 件です。`
}

/**
 * 今日やることを返す。
 *
 * プロジェクトはトークンが決める。**クエリからは受け取らない。**
 */
export async function GET(request: NextRequest) {
  const authenticated = await authenticateRequest(request)
  if ('auth' in authenticated === false) return authenticated

  const { auth, supabase } = authenticated
  const today = todayInJst()

  try {
    // 操作範囲はトークンが決める
    const [tasks, schedules] = await Promise.all([
      createSupabaseTaskRepository(supabase).listByProject(auth.projectId),
      createSupabaseScheduleRepository(supabase).listByProject(auth.projectId),
    ])

    const selected = selectTodayTasks({ tasks, schedules, today })

    return apiOk({
      date: today,
      count: selected.length,
      summary: buildSummary(selected.length),
      tasks: selected,
    })
  } catch {
    return apiError(
      { code: 'UNKNOWN', message: '今日のタスクを取得できませんでした。' },
      500,
    )
  }
}
