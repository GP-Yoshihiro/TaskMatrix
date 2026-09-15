import { GoogleGenAI } from '@google/genai'
import { attemptTimeout, deadlineFrom } from '@/lib/domain/ai-budget'
import { describeAiFailure, isQuotaError, isRetryableAiError } from '@/lib/domain/ai-failure'
import { resolveModelOrder } from '@/lib/domain/model-order'
import { type Result, err, ok } from '@/lib/domain/result'
import type { AiUsage } from '@/lib/domain/usage'
import { readUsage } from './usage'
import { TimeoutError, withTimeout } from './with-timeout'
import { withThinkingLevel } from './with-thinking'
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

// 1 回ごとの上限は置かない。全体の持ち時間から、その都度分け与える

/**
 * 思考の深さ。
 *
 * Gemini 3 系は既定で深く考える。スケジュールの割り付けは
 * **手順が決まっており、深い思考より出力量のほうが時間を支配する。**
 * 浅くして、その分を出力に回す。
 */
const THINKING_LEVEL = 'low'

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
      // 環境変数で遅いモデルを両方に指定すると候補が 1 つに潰れていた。
      // 速いモデルが必ず候補に残るようにする
      const models = resolveModelOrder(
        process.env.GEMINI_MODEL,
        process.env.GEMINI_FALLBACK_MODEL,
      )

      const promptText = buildSchedulePrompt(input)
      const contents = [{ type: 'text', text: promptText }]

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
            withThinkingLevel(
              (params) =>
                ai.interactions.create(params as Parameters<typeof ai.interactions.create>[0]),
              {
                model,
                input: contents,
                response_format: {
                  type: 'text',
                  mime_type: 'application/json',
                  schema: SCHEDULE_SCHEMA,
                },
              },
              THINKING_LEVEL,
            ),
            timeoutMs,
          )

          const outputText = (interaction as { output_text?: string }).output_text ?? ''
          const parsed = parseScheduleResponse(outputText)
          if (!parsed.ok) return parsed

          return ok({
            ...parsed.data,
            usage: readUsage(interaction, model, promptText.length),
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
        }
      }

      // 上限・時間切れ・混雑を区別して伝える。
      // どれも「混雑しています」では、待つべきかどうかが判断できない
      const failure = describeAiFailure({ ranOutOfTime, hitQuota })
      return err(failure.code, failure.message)
    },
  }
}
