/**
 * 算出の提案を、もとのタスクへ結び付ける。
 *
 * 提案は AI が返すため、タスク名が一字一句同じとは限らない。
 * **一致しないものを黙って捨てると、予定が 1 件も出ず、
 * 理由も分からないまま「算出がうまくいかない」状態になる。**
 *
 * ここでは照合を少しだけ緩め、結び付かなかったものは
 * 呼び出し側が件数として扱えるようにする。
 */

/** 空白の違いを無くす。全角の空白も空白として扱う */
function normalize(title: string): string {
  return title.replace(/[\s　]+/g, ' ').trim()
}

/**
 * 日ごとの分割を表す印を落とす。
 *
 * 「複数の日に分けて配置してください」と指示すると、
 * AI は「〇〇（1日目）」のように名前へ印を足すことがある。
 *
 * **落とすのは、数字と区切りだけで出来た末尾の括弧に限る。**
 * 「（田中担当）」のような補足まで落とすと、別のタスクと取り違える。
 */
export function stripSplitMarker(title: string): string {
  return title.replace(/[（(][\d\s/／日目のうち、-]+[）)]\s*$/u, '').trim()
}

/**
 * 当てはまるタスク名を探す。無ければ null。
 *
 * 完全一致 → 空白をそろえて一致 → 分割の印を落として一致、の順に試す。
 */
export function matchTaskTitle(proposed: string, titles: string[]): string | null {
  if (proposed.trim() === '' || titles.length === 0) return null

  const exact = titles.find((title) => title === proposed)
  if (exact) return exact

  const target = normalize(proposed)
  const bySpace = titles.find((title) => normalize(title) === target)
  if (bySpace) return bySpace

  const stripped = normalize(stripSplitMarker(proposed))
  const byMarker = titles.find((title) => normalize(title) === stripped)
  if (byMarker) return byMarker

  return null
}
