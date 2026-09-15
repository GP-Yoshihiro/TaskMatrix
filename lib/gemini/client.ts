import { GoogleGenAI } from '@google/genai'
import { attemptTimeout, deadlineFrom } from '@/lib/domain/ai-budget'
import { describeAiFailure, isQuotaError, isRetryableAiError } from '@/lib/domain/ai-failure'
import { resolveModelOrder } from '@/lib/domain/model-order'
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

// 1 回ごとの上限は置かない。全体の持ち時間から、その都度分け与える

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

      // 環境変数で遅いモデルを両方に指定すると候補が 1 つに潰れていた。
      // 速いモデルが必ず候補に残るようにする
      const models = resolveModelOrder(
        process.env.GEMINI_MODEL,
        process.env.GEMINI_FALLBACK_MODEL,
      )

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
      let hitQuota = false

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
          if (isQuotaError(error)) hitQuota = true
          if (!isRetryableAiError(error)) {
            return err(
              'AI_REQUEST_FAILED',
              'AI への問い合わせに失敗しました。時間をおいてお試しください。',
            )
          }
          // 混雑していたら次のモデルを試す
        }
      }

      // 上限・時間切れ・混雑を区別して伝える
      const failure = describeAiFailure({
        ranOutOfTime,
        hitQuota,
        timeoutMessage:
          'タスクの抽出に時間がかかりすぎたため、中断しました。対象を減らしてお試しください。',
      })
      return err(failure.code, failure.message)
    },
  }
}
