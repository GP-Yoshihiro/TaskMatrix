/**
 * 再算出したときの、既存の予定との重複。
 *
 * 算出は未完了のタスクすべてを対象にするため、
 * すでに予定が決まっているタスクの分も作られる。
 * そのまま確定すると、**同じタスクの予定が二重に増える。**
 *
 * 確定の前に「置き換えるか」を確かめられるようにする。
 */

/** 確定済みの予定のうち、重複の判定に必要な分 */
export type ConfirmedRef = {
  id: string
  taskId: string
  taskTitle: string
  /** Google カレンダーへ送済みなら、その予定の識別子 */
  googleEventId: string
}

/** 仮案のうち、重複の判定に必要な分 */
export type DraftRef = {
  key: string
  taskId: string
  taskTitle: string
}

export type DuplicateTask = {
  taskId: string
  taskTitle: string
  /** 置き換わる既存の予定の件数 */
  existingCount: number
  /** Google に送済みのものが含まれるか */
  hasGoogleEvent: boolean
}

/**
 * すでに予定があるタスクを拾う。
 *
 * 同じタスクの仮案が複数あっても 1 つにまとめる。
 * 同じ見出しを二度出すと、何件が消えるのか分からなくなる。
 */
export function findDuplicateTasks(
  drafts: DraftRef[],
  confirmed: ConfirmedRef[],
): DuplicateTask[] {
  const seen = new Set<string>()
  const found: DuplicateTask[] = []

  for (const draft of drafts) {
    if (seen.has(draft.taskId)) continue
    seen.add(draft.taskId)

    const existing = confirmed.filter((schedule) => schedule.taskId === draft.taskId)
    if (existing.length === 0) continue

    found.push({
      taskId: draft.taskId,
      taskTitle: draft.taskTitle,
      existingCount: existing.length,
      // カレンダー側も消えることを、押す前に伝える必要がある
      hasGoogleEvent: existing.some((schedule) => schedule.googleEventId !== ''),
    })
  }

  return found
}

/**
 * 置き換える対象の予定 ID。
 *
 * 選ばれた仮案のタスクに限る。
 * 選んでいない予定まで消してはいけない。
 */
export function overwriteTargetIds(
  drafts: DraftRef[],
  confirmed: ConfirmedRef[],
): string[] {
  const taskIds = new Set(drafts.map((draft) => draft.taskId))

  return confirmed
    .filter((schedule) => taskIds.has(schedule.taskId))
    .map((schedule) => schedule.id)
}
