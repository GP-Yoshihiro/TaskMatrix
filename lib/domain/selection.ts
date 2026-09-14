/**
 * 一覧の複数選択。
 *
 * 選んだものは識別子の集合で持つ。
 * **表示されていないものには触らない。** 絞り込みの外にあるものを
 * 知らないうちに消させないため。
 */

/** 1 つの選択を入れ替える。元の集合は変えない */
export function toggleOne(selected: Set<string>, id: string): Set<string> {
  // その場で書き換えると、同じ集合のままで描き直しが起きない
  const next = new Set(selected)

  if (next.has(id)) next.delete(id)
  else next.add(id)

  return next
}

/**
 * 表示中のものをまとめて入れ替える。
 *
 * すべて選ばれていれば外し、そうでなければ全部選ぶ。
 * **表示されていないものは触らない。**
 */
export function toggleAll(selected: Set<string>, visibleIds: string[]): Set<string> {
  const next = new Set(selected)

  if (allSelected(selected, visibleIds)) {
    for (const id of visibleIds) next.delete(id)
    return next
  }

  for (const id of visibleIds) next.add(id)
  return next
}

/** 表示中のものがすべて選ばれているか。表示が空なら偽 */
export function allSelected(selected: Set<string>, visibleIds: string[]): boolean {
  if (visibleIds.length === 0) return false
  return visibleIds.every((id) => selected.has(id))
}

/**
 * 選択の状況を表す言葉。
 *
 * **数えるのは表示中のものだけ。** 絞り込みで隠れているものを数に入れると、
 * 実際に消える数と食い違う。
 */
export function selectionSummary(selected: Set<string>, visibleIds: string[]): string {
  const count = visibleIds.filter((id) => selected.has(id)).length

  if (count === 0) return 'まだ選んでいません。'
  return `${count} 件を選択中`
}
