import { describe, expect, it } from 'vitest'
import {
  EXTRACTION_SCHEMA,
  buildPrompt,
  parseExtractionResponse,
} from '@/lib/gemini/extract-tasks'

describe('buildPrompt', () => {
  it('本文を含める', () => {
    expect(buildPrompt('会議メモ')).toContain('会議メモ')
  })

  it('日本語で出力するよう指示する', () => {
    expect(buildPrompt('x')).toContain('日本語')
  })

  it('曖昧な期限を空文字にするよう指示する', () => {
    const prompt = buildPrompt('x')
    expect(prompt).toContain('YYYY-MM-DD')
    expect(prompt).toContain('ambiguity_note')
  })

  it('推測でタスクを作らないよう指示する', () => {
    expect(buildPrompt('x')).toContain('推測')
  })
})

describe('EXTRACTION_SCHEMA', () => {
  it('tasks と document_summary を必須にする', () => {
    expect([...EXTRACTION_SCHEMA.required]).toEqual(['tasks', 'document_summary'])
  })

  it('優先度を 3 種類に限定する', () => {
    const priority = EXTRACTION_SCHEMA.properties.tasks.items.properties.priority
    expect([...priority.enum]).toEqual(['high', 'medium', 'low'])
  })

  it('タスクの全項目を必須にする', () => {
    const required = EXTRACTION_SCHEMA.properties.tasks.items.required
    expect([...required].sort()).toEqual([
      'ai_suggestion',
      'ambiguity_note',
      'assignee',
      'description',
      'due_date',
      'priority',
      'title',
    ])
  })
})

describe('parseExtractionResponse', () => {
  const valid = JSON.stringify({
    tasks: [
      {
        title: '見積もりを提出する',
        description: '来週までに見積もりを作成して提出する',
        priority: 'high',
        assignee: '',
        due_date: '',
        ambiguity_note: '「来週」が具体的な日付を指していません。',
        ai_suggestion: '提出期限を具体的な日付で決めてください。',
      },
    ],
    document_summary: '会議メモから 1 件のタスクを抽出しました。',
  })

  it('正しい JSON を解釈する', () => {
    const result = parseExtractionResponse(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.tasks).toHaveLength(1)
      expect(result.data.tasks[0].title).toBe('見積もりを提出する')
    }
  })

  it('JSON として壊れていたら拒否する', () => {
    const result = parseExtractionResponse('これはJSONではありません')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('AI_RESPONSE_INVALID')
  })

  it('空文字を拒否する', () => {
    expect(parseExtractionResponse('').ok).toBe(false)
  })

  it('必須項目が欠けていたら拒否する', () => {
    const result = parseExtractionResponse(JSON.stringify({ tasks: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('AI_RESPONSE_INVALID')
  })

  it('想定外の優先度を拒否する', () => {
    const broken = JSON.parse(valid)
    broken.tasks[0].priority = 'urgent'
    expect(parseExtractionResponse(JSON.stringify(broken)).ok).toBe(false)
  })

  it('タスクが 0 件でも成功として扱う', () => {
    const empty = JSON.stringify({ tasks: [], document_summary: 'タスクはありません。' })
    const result = parseExtractionResponse(empty)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.tasks).toHaveLength(0)
  })

  it('コードフェンスで囲まれた JSON も解釈する', () => {
    const fenced = '```json\n' + valid + '\n```'
    const result = parseExtractionResponse(fenced)
    expect(result.ok).toBe(true)
  })
})
