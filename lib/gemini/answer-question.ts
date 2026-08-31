import { GoogleGenAI } from '@google/genai'
import { type Result, err, ok } from '@/lib/domain/result'
import type { PromptExcerpt, PromptMessage } from '@/lib/domain/rag'
import { buildAnswerPrompt } from '@/lib/domain/rag'
import type { AiUsage } from '@/lib/domain/usage'
import { readUsage } from './usage'
import { TimeoutError, withTimeout } from './with-timeout'

export interface QuestionAnswerer {
  answer(input: {
    question: string
    excerpts: PromptExcerpt[]
    history: PromptMessage[]
  }): Promise<Result<{ text: string; usage: AiUsage }>>
}

const DEFAULT_MODEL = 'gemini-3.7-flash'
const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash'
const REQUEST_TIMEOUT_MS = 90_000

function isRetryable(error: unknown): boolean {
  if (error instanceof TimeoutError) return true
  const status = (error as { status?: number })?.status
  return status === 429 || status === 500 || status === 502 || status === 503
}

export function createGeminiQuestionAnswerer(): QuestionAnswerer {
  return {
    async answer(input) {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) return err('AI_NOT_CONFIGURED', 'AI 機能が設定されていません。')

      const ai = new GoogleGenAI({ apiKey })
      const models = [
        process.env.GEMINI_MODEL || DEFAULT_MODEL,
        process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
      ].filter((model, index, all) => all.indexOf(model) === index)

      const promptText = buildAnswerPrompt(input)
      const contents = [{ type: 'text', text: promptText }]

      for (const model of models) {
        try {
          const interaction = await withTimeout(
            ai.interactions.create({
              model,
              input: contents,
            } as Parameters<typeof ai.interactions.create>[0]),
            REQUEST_TIMEOUT_MS,
          )

          const text = (interaction as { output_text?: string }).output_text ?? ''
          if (text.trim().length === 0) {
            return err('AI_RESPONSE_INVALID', 'AI の応答を解釈できませんでした。')
          }
          return ok({ text, usage: readUsage(interaction, model, promptText.length) })
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
