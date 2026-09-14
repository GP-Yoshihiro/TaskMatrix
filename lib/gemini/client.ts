import { GoogleGenAI } from '@google/genai'
import { attemptTimeout, deadlineFrom } from '@/lib/domain/ai-budget'
import { type Result, err, ok } from '@/lib/domain/result'
import type { AiUsage } from '@/lib/domain/usage'
import { readUsage } from './usage'
import { TimeoutError, withTimeout } from './with-timeout'
import {
  EXTRACTION_SCHEMA,
  type ExtractedTask,
  buildPrompt,
  parseExtractionResponse,
} from './extract-tasks'

export type ExtractionResult = {
  tasks: ExtractedTask[]
  document_summary: string
  usage: AiUsage
}

export interface TaskExtractor {
  extract(input: { text: string } | { pdf: Uint8Array }): Promise<Result<ExtractionResult>>
}

/*
 * 既定は**速い方を先**にする。
 *
 * 2026-09-14 の実測で、gemini-3.7-flash は「はい」と返すだけで
 * 47.6 秒 / 115.9 秒かかり、3 回目は 429 で拒否された。
 * gemini-3.5-flash は同じ問いに 3〜4 秒で返る。
 *
 * 環境変数で上書きできるが、**遅いモデルを指定すると中断しやすくなる。**
 */
const DEFAULT_MODEL = 'gemini-3.5-flash'
const DEFAULT_FALLBACK_MODEL = 'gemini-3.7-flash'

/** 混雑・レート制限は別モデルで再試行する価値がある */
/**
 * 応答が返らないまま固まるのを防ぐ。
 * 実測では 20〜31 秒で完了するため、その 3 倍程度を上限とする。
 * Server Action の maxDuration (120 秒) より短くし、
 * 打ち切られる前に日本語のエラーを返せるようにする。
 */
// 1 回ごとの上限は置かない。全体の持ち時間から、その都度分け与える

function isRetryable(error: unknown): boolean {
  if (error instanceof TimeoutError) return true
  const status = (error as { status?: number })?.status
  return status === 429 || status === 500 || status === 502 || status === 503
}

/**
 * Gemini によるタスク抽出。
 *
 * 2026-08-30 の検証で既定モデルが 500「currently experiencing high demand」を
 * 継続的に返したため、5xx / 429 のときはフォールバックモデルへ切り替える。
 */
export function createGeminiTaskExtractor(): TaskExtractor {
  return {
    async extract(input) {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        return err('AI_NOT_CONFIGURED', 'AI 機能が設定されていません。')
      }

      const ai = new GoogleGenAI({ apiKey })

      const models = [
        process.env.GEMINI_MODEL || DEFAULT_MODEL,
        process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
      ].filter((model, index, all) => all.indexOf(model) === index)

      // PDF は本体を送るため文字数を測れない。推定せず 0 とする
      const inputChars = 'pdf' in input ? 0 : input.text.length

      const contents =
        'pdf' in input
          ? [
              { type: 'text', text: buildPrompt('（添付の PDF を読んでください）') },
              {
                type: 'document',
                data: Buffer.from(input.pdf).toString('base64'),
                mime_type: 'application/pdf',
              },
            ]
          : [{ type: 'text', text: buildPrompt(input.text) }]

      // 全体の持ち時間を決め、各回はその残りを分け合う。
      // 1 回ごとに上限を置くと、予備のモデルを試した合計が画面側の上限を超える
      const deadlineAt = deadlineFrom(Date.now())
      let ranOutOfTime = false

      for (const [index, model] of models.entries()) {
        // 残りを、これから試す回数で分ける。
        // 1 回目に全部与えると、遅いモデルに当たったとき予備を試せない
        const timeoutMs = attemptTimeout(deadlineAt, Date.now(), models.length - index)
        if (timeoutMs === null) {
          // 必ず切れる呼び出しは始めない
          ranOutOfTime = true
          break
        }

        try {
          const interaction = await withTimeout(
            ai.interactions.create({
            model,
            input: contents,
            response_format: {
              type: 'text',
              mime_type: 'application/json',
              schema: EXTRACTION_SCHEMA,
            },
            } as Parameters<typeof ai.interactions.create>[0]),
            timeoutMs,
          )

          const outputText = (interaction as { output_text?: string }).output_text ?? ''
          const parsed = parseExtractionResponse(outputText)
          if (!parsed.ok) return parsed

          return ok({
            ...parsed.data,
            usage: readUsage(interaction, model, inputChars),
          })
        } catch (error) {
          if (error instanceof TimeoutError) ranOutOfTime = true
          if (!isRetryable(error)) {
            return err(
              'AI_REQUEST_FAILED',
              'AI への問い合わせに失敗しました。時間をおいてお試しください。',
            )
          }
          // 混雑していたら次のモデルを試す
        }
      }

      if (ranOutOfTime) {
        return err(
          'AI_TIMEOUT',
          'タスクの抽出に時間がかかりすぎたため、中断しました。対象を減らしてお試しください。',
        )
      }

      return err('AI_MODEL_UNAVAILABLE', 'AI が混雑しています。時間をおいてお試しください。')
    },
  }
}
