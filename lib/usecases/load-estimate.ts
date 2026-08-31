import {
  ESTIMATE_SAMPLE_SIZE,
  type AiOperation,
  type Estimate,
  estimateDuration,
} from '@/lib/domain/usage'
import type { AiUsageRepository } from '@/lib/repositories/ai-usage'

/**
 * 画面に渡す予測時間を求める。
 *
 * 記録が読めなくても初期値で描画を続ける。
 * 予測は補助的な情報であり、これが原因で画面が出ないのは本末転倒であるため。
 */
export async function loadEstimate(
  repository: AiUsageRepository,
  operation: AiOperation,
): Promise<Estimate> {
  try {
    const durations = await repository.recentDurations(operation, ESTIMATE_SAMPLE_SIZE)
    return estimateDuration(operation, durations)
  } catch {
    return estimateDuration(operation, [])
  }
}
