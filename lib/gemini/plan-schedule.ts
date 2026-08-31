import { z } from 'zod'
import { type Result, err, ok } from '@/lib/domain/result'
import { TASK_WEIGHTS, type TaskWeight, type WorkSettings } from '@/lib/domain/schedule'

export type RawSchedule = {
  task_title: string
  starts_at: string
  ends_at: string
  reason: string
  weight: TaskWeight
  overlap_acceptable: boolean
}

export type SchedulePromptInput = {
  today: string
  settings: WorkSettings
  tasks: {
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
    dueDate: string | null
  }[]
  confirmed: { taskTitle: string; startsAt: string; endsAt: string }[]
}

/** Gemini の構造化出力に渡す JSON スキーマ */
export const SCHEDULE_SCHEMA = {
  type: 'object',
  properties: {
    schedules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task_title: { type: 'string', description: '対象のタスク名。入力と完全に一致させる' },
          starts_at: { type: 'string', description: 'ISO 8601。タイムゾーン付き' },
          ends_at: { type: 'string', description: 'ISO 8601。タイムゾーン付き' },
          reason: { type: 'string', description: 'なぜその日時にしたか。日本語' },
          weight: { type: 'string', enum: [...TASK_WEIGHTS] },
          overlap_acceptable: {
            type: 'boolean',
            description: '既存の予定と重なっても差し支えないか',
          },
        },
        required: [
          'task_title',
          'starts_at',
          'ends_at',
          'reason',
          'weight',
          'overlap_acceptable',
        ],
      },
    },
    overall_note: { type: 'string', description: '全体方針の説明。1〜3文' },
  },
  required: ['schedules', 'overall_note'],
} as const

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' } as const

export function buildSchedulePrompt(input: SchedulePromptInput): string {
  const workDays = input.settings.workDays
    .map((day) => WEEKDAY_LABELS[day])
    .filter(Boolean)
    .join('・')

  const taskLines = input.tasks
    .map((task) => {
      const parts = [
        `- ${task.title}`,
        `優先度: ${PRIORITY_LABELS[task.priority]}`,
        `期限: ${task.dueDate ?? '未定'}`,
      ]
      if (task.description) parts.push(`説明: ${task.description}`)
      return parts.join(' / ')
    })
    .join('\n')

  const confirmedLines =
    input.confirmed.length === 0
      ? 'なし'
      : input.confirmed
          .map((item) => `- ${item.taskTitle}: ${item.startsAt} 〜 ${item.endsAt}`)
          .join('\n')

  return `あなたはプロジェクト管理の専門家です。次のタスクに実行日時を割り当ててください。

今日の日付: ${input.today}

稼働条件:
- 稼働する曜日: ${workDays}
- 稼働時間帯: ${input.settings.workStart} 〜 ${input.settings.workEnd}
- 1 日に割り当てる上限: ${input.settings.dailyCapacityMinutes} 分
- タイムゾーン: ${input.settings.timezone}

すでに確定している予定:
${confirmedLines}

予定を立てるタスク:
${taskLines}

出力の決まり:
- starts_at と ends_at は ISO 8601 形式でタイムゾーンを付けてください（例 2026-09-01T09:00:00+09:00）。
- 稼働する曜日と稼働時間帯の中に収めてください。1 つの予定が日をまたがないようにしてください。
- 所要時間はタスクの内容から推定してください。1 日の上限を超えないように分割せず、
  収まらない場合は別の日に配置してください。
- weight は次の 5 段階から選んでください。
  very_heavy（非常に重い）/ heavy（重い）/ normal（標準）/ light（軽い）/ very_light（非常に軽い）
- weight は優先度と推定作業工数の組み合わせで決めてください。
  優先度が高くても数分で終わるものは軽くしてください。
  優先度が低くても長時間を要するものは中程度以上にしてください。
- overlap_acceptable は、その予定が既存の予定と重なっても差し支えないかを weight から判断してください。
- reason は日本語で、なぜその日時にしたかを簡潔に書いてください。
- **重複を無理に避けないでください。** 稼働条件の中に収めることを優先し、
  どうしても既存の予定と重ねるしかない場合はそのまま重ねて構いません。
  重ねた場合は reason にその旨を書いてください。
- 予定を立てられるタスクがない場合は schedules を空配列にしてください。`
}

const scheduleSchema = z.object({
  task_title: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  reason: z.string(),
  weight: z.enum(TASK_WEIGHTS),
  overlap_acceptable: z.boolean(),
})

const responseSchema = z.object({
  schedules: z.array(scheduleSchema),
  overall_note: z.string(),
})

function stripCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/)
  return match ? match[1] : text
}

export function parseScheduleResponse(
  outputText: string,
): Result<{ schedules: RawSchedule[]; overall_note: string }> {
  const invalid = err(
    'AI_RESPONSE_INVALID',
    '算出結果を解釈できませんでした。もう一度お試しください。',
  )

  let raw: unknown
  try {
    raw = JSON.parse(stripCodeFence(outputText))
  } catch {
    return invalid
  }

  const parsed = responseSchema.safeParse(raw)
  if (!parsed.success) return invalid

  return ok(parsed.data)
}
