import { GoogleGenAI } from '@google/genai'
import { type Result, err, ok } from '@/lib/domain/result'
import type { AiUsage } from '@/lib/domain/usage'
import { readUsage } from './usage'
import { TimeoutError, withTimeout } from './with-timeout'
import {
  SCHEDULE_SCHEMA,
  type RawSchedule,
  type SchedulePromptInput,
  buildSchedulePrompt,
  parseScheduleResponse,
} from './plan-schedule'

export type PlanResult = {
  schedules: RawSchedule[]
  overall_note: string
  usage: AiUsage
}

export interface SchedulePlanner {
  plan(input: SchedulePromptInput): Promise<Result<PlanResult>>
}

const DEFAULT_MODEL = 'gemini-3.7-flash'
const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash'

/**
 * 応答が返らないまま固まるのを防ぐ。
 * 実測では 20〜31 秒で完了するため、その 3 倍程度を上限とする。
 * Server Action の maxDuration (120 秒) より短くし、
 * 打ち切られる前に日本語のエラーを返せるようにする。
 */
const REQUEST_TIMEOUT_MS = 90_000

function isRetryable(error: unknown): boolean {
  if (error instanceof TimeoutError) return true
  const status = (error as { status?: number })?.status
  return status === 429 || status === 500 || status === 502 || status === 503
}

/**
 * Gemini によるスケジュール算出。
 * P2 の抽出と同じく、既定モデルが 5xx を返したらフォールバックへ切り替える。
 */
export function createGeminiSchedulePlanner(): SchedulePlanner {
  return {
    async plan(input) {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        return err('AI_NOT_CONFIGURED', 'AI 機能が設定されていません。')
      }

      const ai = new GoogleGenAI({ apiKey })
      const models = [
        process.env.GEMINI_MODEL || DEFAULT_MODEL,
        process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
      ].filter((model, index, all) => all.indexOf(model) === index)

      const promptText = buildSchedulePrompt(input)
      const contents = [{ type: 'text', text: promptText }]

      for (const model of models) {
        try {
          const interaction = await withTimeout(
            ai.interactions.create({
            model,
            input: contents,
            response_format: {
              type: 'text',
              mime_type: 'application/json',
              schema: SCHEDULE_SCHEMA,
            },
            } as Parameters<typeof ai.interactions.create>[0]),
            REQUEST_TIMEOUT_MS,
          )

          const outputText = (interaction as { output_text?: string }).output_text ?? ''
          const parsed = parseScheduleResponse(outputText)
          if (!parsed.ok) return parsed

          return ok({
            ...parsed.data,
            usage: readUsage(interaction, model, promptText.length),
          })
        } catch (error) {
          if (!isRetryable(error)) {
            return err(
              'AI_REQUEST_FAILED',
              'AI への問い合わせに失敗しました。時間をおいてお試しください。',
            )
          }
        }
      }

      return err('AI_MODEL_UNAVAILABLE', 'AI が混雑しています。時間をおいてお試しください。')
    },
  }
}
