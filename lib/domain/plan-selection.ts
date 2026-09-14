/**
 * スケジュール算出の対象を絞る。
 *
 * 未完了のタスクが多いと、AI の応答が持ち時間に収まらず中断する。
 * **1 度に扱う件数に上限を置き、超える場合は利用者に選んでもらう。**
 *
 * 上限を超えた分を勝手に切り落とさない。
 * どれが対象から外れたのか分からないまま予定が組まれるのは、
 * 「なぜこのタスクの予定が無いのか」を追えなくする。
 */

import { type Result, err, ok } from './result'

/** 1 度に扱う上限。多すぎると時間切れで中断する */
export const MAX_PLAN_TASKS = 100

/** 選んでもらう必要があるか */
export function needsSelection(pendingCount: number): boolean {
  return pendingCount > MAX_PLAN_TASKS
}

/** 選択が妥当か。通らないときは理由を返す */
export function validatePlanSelection(
  selectedIds: string[],
  pendingCount: number,
): Result<null> {
  if (selectedIds.length > MAX_PLAN_TASKS) {
    return err(
      'VALIDATION_ERROR',
      `1 度に算出できるのは ${MAX_PLAN_TASKS} 件までです。選ぶ数を減らしてください。`,
    )
  }

  if (selectedIds.length === 0 && needsSelection(pendingCount)) {
    return err(
      'VALIDATION_ERROR',
      `未完了のタスクが ${pendingCount} 件あります。算出するタスクを ${MAX_PLAN_TASKS} 件まで選んでください。`,
    )
  }

  return ok(null)
}

/**
 * 算出の対象を決める。
 *
 * 選択があればそれに絞る。無ければ全件。
 * 選択が無く上限を超えている場合だけは、念のため上限までに切る
 * （本筋は画面側で選ばせること）。
 */
export function pickTasksToPlan<T extends { id: string }>(
  pending: T[],
  selectedIds: string[],
): T[] {
  if (selectedIds.length === 0) return pending.slice(0, MAX_PLAN_TASKS)

  const wanted = new Set(selectedIds)
  // 元の並びを保つ。選んだ順ではなく、一覧の順で扱う
  return pending.filter((task) => wanted.has(task.id))
}
