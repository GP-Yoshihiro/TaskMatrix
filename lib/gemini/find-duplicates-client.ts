import { GoogleGenAI } from '@google/genai'
import {
  DUPLICATE_SCHEMA,
  type DuplicateCandidate,
  buildDuplicatePrompt,
  parseDuplicateResponse,
} from '@/lib/gemini/find-duplicates'
import { type Result, err, ok } from '@/lib/domain/result'
import { EMPTY_USAGE, type AiUsage } from '@/lib/domain/usage'
import { readUsage } from '@/lib/gemini/usage'

/** 応答を待つ上限。判定は軽い処理なので、抽出より短くてよい */
const REQUEST_TIMEOUT_MS = 45_000

const DEFAULT_MODEL = 'gemini-3.5-flash'
const DEFAULT_FALLBACK_MODEL = 'gemini-3.7-flash'

export interface DuplicateFinder {
  find(
    candidates: DuplicateCandidate[],
  ): Promise<Result<{ groups: string[][]; usage: AiUsage }>>
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status ?? 0
  return status >= 500 || status === 429
}

/**
 * Gemini による重複の判定。
 *
 * **失敗しても抽出そのものは止めない。** 判定は付随的な処理であり、
 * まとめられなくても、抽出した一覧はそのまま使える。
 * 呼び出し側は空の組分けとして扱えばよい。
 */
export function createGeminiDuplicateFinder(): DuplicateFinder {
  return {
    async find(candidates) {
      // 2 件未満なら比べる相手がいない。呼ばずに済ませる
      if (candidates.length < 2) return ok({ groups: [], usage: EMPTY_USAGE })

      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) return err('AI_NOT_CONFIGURED', 'AI 機能が設定されていません。')

      const ai = new GoogleGenAI({ apiKey })
      const prompt = buildDuplicatePrompt(candidates)

      const models = [
        process.env.GEMINI_MODEL || DEFAULT_MODEL,
        process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
      ].filter((model, index, all) => all.indexOf(model) === index)

      for (const model of models) {
        try {
          const interaction = await withTimeout(
            ai.interactions.create({
              model,
              input: [{ type: 'text', text: prompt }],
              response_format: {
                type: 'text',
                mime_type: 'application/json',
                schema: DUPLICATE_SCHEMA,
              },
            } as Parameters<typeof ai.interactions.create>[0]),
            REQUEST_TIMEOUT_MS,
          )

          const outputText = (interaction as { output_text?: string }).output_text ?? ''

          let raw: unknown
          try {
            raw = JSON.parse(outputText)
          } catch {
            return err('VALIDATION_ERROR', '重複の判定結果を解釈できませんでした。')
          }

          const parsed = parseDuplicateResponse(raw)
          if (!parsed.ok) return parsed

          return ok({
            groups: parsed.data,
            usage: readUsage(interaction, model, prompt.length),
          })
        } catch (error) {
          if (!isRetryable(error)) {
            return err(
              'AI_REQUEST_FAILED',
              'AI への問い合わせに失敗しました。時間をおいてお試しください。',
            )
          }
          // 混雑していたら次のモデルを試す
        }
      }

      return err('AI_REQUEST_FAILED', 'AI が混雑しています。時間をおいてお試しください。')
    },
  }
}
