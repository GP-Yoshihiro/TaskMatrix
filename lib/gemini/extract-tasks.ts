import { z } from 'zod'
import { type Result, err, ok } from '@/lib/domain/result'

export type ExtractedTask = {
  title: string
  description: string
  priority: string
  assignee: string
  due_date: string
  ambiguity_note: string
  ai_suggestion: string
}

/** Gemini の構造化出力に渡す JSON スキーマ */
export const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'タスク名。簡潔な動詞句にする' },
          description: { type: 'string', description: '何をするかの説明' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          assignee: {
            type: 'string',
            description: '文書から読み取れる担当者。不明なら空文字',
          },
          due_date: {
            type: 'string',
            description: 'YYYY-MM-DD 形式のみ。曖昧なら空文字',
          },
          ambiguity_note: {
            type: 'string',
            description: '記述が不透明な点。なければ空文字',
          },
          ai_suggestion: {
            type: 'string',
            description: 'タスク化に向けた改善案。なければ空文字',
          },
        },
        required: [
          'title',
          'description',
          'priority',
          'assignee',
          'due_date',
          'ambiguity_note',
          'ai_suggestion',
        ],
      },
    },
    document_summary: { type: 'string', description: 'ドキュメント全体の要約。1〜3文' },
  },
  required: ['tasks', 'document_summary'],
} as const

export function buildPrompt(text: string): string {
  return `あなたはプロジェクト管理の専門家です。次のドキュメントを読み、実行すべきタスクを抽出してください。

出力の決まり:
- すべて日本語で書いてください。
- title は簡潔な動詞句にしてください（例: 見積もりを提出する）。
- due_date は YYYY-MM-DD 形式の確定した日付のみ書いてください。
  「来週」「適宜」「なるべく早く」のような曖昧な表現の場合は due_date を空文字にし、
  その表現が曖昧であることを ambiguity_note に日本語で書いてください。
- assignee は文書から明確に読み取れる場合のみ書き、不明なら空文字にしてください。
- 記述が不透明でタスクとして実行できない点があれば ambiguity_note に指摘してください。
- タスクとして成立させるための具体的な改善案を ai_suggestion に書いてください。
- タスクが見当たらない場合は tasks を空配列にしてください。推測でタスクを作らないでください。

ドキュメント:
---
${text}
---`
}

const taskSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  assignee: z.string(),
  due_date: z.string(),
  ambiguity_note: z.string(),
  ai_suggestion: z.string(),
})

const responseSchema = z.object({
  tasks: z.array(taskSchema),
  document_summary: z.string(),
})

/** コードフェンスで囲まれて返ってきた場合に中身だけを取り出す */
function stripCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/)
  return match ? match[1] : text
}

export function parseExtractionResponse(
  outputText: string,
): Result<{ tasks: ExtractedTask[]; document_summary: string }> {
  const invalid = err(
    'AI_RESPONSE_INVALID',
    'AI の応答を解釈できませんでした。もう一度お試しください。',
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
