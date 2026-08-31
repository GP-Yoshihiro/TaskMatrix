import type { AiUsage } from '@/lib/domain/usage'

type InteractionUsage = {
  usage?: { total_input_tokens?: number; total_output_tokens?: number }
}

/**
 * Gemini の応答から使用量を読む。
 *
 * model には**実際に応答したモデル**を渡す。混雑でフォールバックが働いたとき、
 * 要求したモデル名を記録すると履歴が実態とずれるため。
 */
export function readUsage(
  interaction: unknown,
  model: string,
  inputChars: number,
): AiUsage {
  const usage = (interaction as InteractionUsage).usage

  return {
    model,
    inputTokens: usage?.total_input_tokens ?? 0,
    outputTokens: usage?.total_output_tokens ?? 0,
    inputChars,
  }
}
