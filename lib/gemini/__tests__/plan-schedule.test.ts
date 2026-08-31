import { describe, expect, it } from 'vitest'
import { DEFAULT_WORK_SETTINGS } from '@/lib/domain/schedule'
import {
  SCHEDULE_SCHEMA,
  buildSchedulePrompt,
  parseScheduleResponse,
} from '@/lib/gemini/plan-schedule'

const promptInput = {
  today: '2026-08-31',
  settings: DEFAULT_WORK_SETTINGS,
  tasks: [
    {
      title: '見積もりを提出する',
      description: '',
      priority: 'high' as const,
      dueDate: '2026-09-10',
    },
  ],
  confirmed: [
    {
      taskTitle: '定例会議',
      startsAt: '2026-09-01T10:00:00+09:00',
      endsAt: '2026-09-01T11:00:00+09:00',
    },
  ],
}

describe('buildSchedulePrompt', () => {
  it('今日の日付を含める', () => {
    expect(buildSchedulePrompt(promptInput)).toContain('2026-08-31')
  })

  it('タスク名と期限を含める', () => {
    const prompt = buildSchedulePrompt(promptInput)
    expect(prompt).toContain('見積もりを提出する')
    expect(prompt).toContain('2026-09-10')
  })

  it('稼働時間帯を含める', () => {
    const prompt = buildSchedulePrompt(promptInput)
    expect(prompt).toContain('09:00')
    expect(prompt).toContain('18:00')
  })

  it('稼働曜日を日本語で含める', () => {
    const prompt = buildSchedulePrompt(promptInput)
    expect(prompt).toContain('月')
    expect(prompt).toContain('金')
  })

  it('確定済みの予定を含める', () => {
    expect(buildSchedulePrompt(promptInput)).toContain('定例会議')
  })

  it('確定済みの予定が無いときは「なし」と書く', () => {
    const prompt = buildSchedulePrompt({ ...promptInput, confirmed: [] })
    expect(prompt).toContain('なし')
  })

  it('重さを 5 段階で判定するよう指示する', () => {
    const prompt = buildSchedulePrompt(promptInput)
    expect(prompt).toContain('very_heavy')
    expect(prompt).toContain('very_light')
  })

  it('優先度をそのまま重さにしないよう指示する', () => {
    expect(buildSchedulePrompt(promptInput)).toContain('数分で終わる')
  })

  it('重複を無理に避けないよう指示する', () => {
    expect(buildSchedulePrompt(promptInput)).toContain('重ねて')
  })

  it('日本語で理由を書くよう指示する', () => {
    expect(buildSchedulePrompt(promptInput)).toContain('日本語')
  })
})

describe('SCHEDULE_SCHEMA', () => {
  it('schedules と overall_note を必須にする', () => {
    expect([...SCHEDULE_SCHEMA.required]).toEqual(['schedules', 'overall_note'])
  })

  it('重さを 5 段階に限定する', () => {
    const weight = SCHEDULE_SCHEMA.properties.schedules.items.properties.weight
    expect([...weight.enum]).toEqual([
      'very_heavy',
      'heavy',
      'normal',
      'light',
      'very_light',
    ])
  })

  it('各予定の項目をすべて必須にする', () => {
    const required = SCHEDULE_SCHEMA.properties.schedules.items.required
    expect([...required].sort()).toEqual([
      'ends_at',
      'overlap_acceptable',
      'reason',
      'starts_at',
      'task_title',
      'weight',
    ])
  })
})

describe('parseScheduleResponse', () => {
  const valid = JSON.stringify({
    schedules: [
      {
        task_title: '見積もりを提出する',
        starts_at: '2026-09-01T09:00:00+09:00',
        ends_at: '2026-09-01T11:00:00+09:00',
        reason: '期限まで余裕があるうちに着手するため。',
        weight: 'heavy',
        overlap_acceptable: false,
      },
    ],
    overall_note: '優先度の高いものから順に配置しました。',
  })

  it('正しい JSON を解釈する', () => {
    const result = parseScheduleResponse(valid)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.schedules).toHaveLength(1)
  })

  it('壊れた JSON を拒否する', () => {
    const result = parseScheduleResponse('JSONではない')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('AI_RESPONSE_INVALID')
  })

  it('想定外の重さを拒否する', () => {
    const broken = JSON.parse(valid)
    broken.schedules[0].weight = 'extreme'
    expect(parseScheduleResponse(JSON.stringify(broken)).ok).toBe(false)
  })

  it('必須項目が欠けていたら拒否する', () => {
    expect(parseScheduleResponse(JSON.stringify({ schedules: [] })).ok).toBe(false)
  })

  it('コードフェンス付きでも解釈する', () => {
    expect(parseScheduleResponse('```json\n' + valid + '\n```').ok).toBe(true)
  })

  it('予定が 0 件でも成功として扱う', () => {
    const empty = JSON.stringify({ schedules: [], overall_note: 'なし' })
    expect(parseScheduleResponse(empty).ok).toBe(true)
  })
})
