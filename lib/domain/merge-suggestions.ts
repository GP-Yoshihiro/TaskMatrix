/**
 * 複数の資料から抽出したタスクの、重複の統合。
 *
 * 同じ作業が別の資料に書かれていると、同じタスクが何件も並ぶ。
 * どれを残すか選ばせると手間なので、**良いところ取り**でまとめる。
 *
 * **どちらに寄せるかは、取りこぼさない側に統一する。**
 * 優先度は高い方、期限は早い方、想定日程は長い方。
 * 低く・遅く・短く見積もると、計画が破綻したときに気付けない。
 *
 * 組分け（どれとどれが同じか）はここで決めない。AI の判定を受け取る。
 */

import type { TaskPriority } from './tasks'
import type { EstimateSource } from './estimate-days'

/** 統合の対象。抽出した 1 件分 */
export type SuggestionLike = {
  /** 画面と AI の判定で使う識別子 */
  key: string
  title: string
  description: string
  priority: TaskPriority
  assignee: string
  dueDate: string | null
  ambiguityNote: string
  aiSuggestion: string
  estimatedDays: number | null
  estimateSource: EstimateSource | ''
  /** どの資料から出たか */
  sourceFileName: string
}

export type MergedSuggestion = SuggestionLike & {
  /** まとめた件数。1 ならまとめていない */
  mergedCount: number
  /** まとめた元の資料名 */
  mergedFrom: string[]
  /** まとめた元の識別子 */
  mergedKeys: string[]
}

/** 高いほど優先。比較のための重み */
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 }

/** 重複を 1 件にまとめる。良いところ取り */
export function mergeGroup(items: SuggestionLike[]): MergedSuggestion {
  const [first, ...rest] = items

  const merged = rest.reduce<SuggestionLike>((acc, item) => {
    return {
      ...acc,
      // 短い方を採ると、書かれていた条件が落ちる
      description:
        item.description.length > acc.description.length ? item.description : acc.description,
      // 低い方に寄せると、急ぎの作業を見落とす
      priority: PRIORITY_RANK[item.priority] > PRIORITY_RANK[acc.priority]
        ? item.priority
        : acc.priority,
      // 入っている方を採る
      assignee: acc.assignee || item.assignee,
      // 遅い方に寄せると、間に合わなくなる
      dueDate: earlier(acc.dueDate, item.dueDate),
      // 短く見積もると、日程が破綻する
      estimatedDays: longer(acc.estimatedDays, item.estimatedDays),
      // 出どころは、資料に書かれていた方を優先する
      estimateSource: acc.estimateSource === 'document' ? acc.estimateSource : item.estimateSource,
      // どちらかを捨てると、確かめるべきことが消える
      ambiguityNote: joinUnique(acc.ambiguityNote, item.ambiguityNote),
      aiSuggestion: joinUnique(acc.aiSuggestion, item.aiSuggestion),
    }
  }, first)

  return {
    ...merged,
    mergedCount: items.length,
    // まとめた根拠を、後から確かめられるようにする
    mergedFrom: [...new Set(items.map((item) => item.sourceFileName))],
    mergedKeys: items.map((item) => item.key),
  }
}

function earlier(a: string | null, b: string | null): string | null {
  if (a === null) return b
  if (b === null) return a
  return a <= b ? a : b
}

function longer(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return Math.max(a, b)
}

/** 重ならないように繋ぐ。同じ内容を二度並べない */
function joinUnique(a: string, b: string): string {
  const parts = [a, b].map((part) => part.trim()).filter((part) => part !== '')
  return [...new Set(parts)].join(' / ')
}

/**
 * AI が示した組分けを当てはめる。
 *
 * 組に入らなかったものはそのまま残す。
 * 知らない識別子は無視する。AI が実在しない鍵を返しても壊さない。
 */
export function applyGroups(
  items: SuggestionLike[],
  groups: string[][],
): MergedSuggestion[] {
  const byKey = new Map(items.map((item) => [item.key, item]))
  const used = new Set<string>()
  const result: MergedSuggestion[] = []

  for (const group of groups) {
    // すでに他の組に入ったものは含めない。二重に並べない
    const members = group
      .filter((key) => !used.has(key))
      .map((key) => byKey.get(key))
      .filter((item): item is SuggestionLike => item !== undefined)

    // 1 件だけの組は、まとめたことにしない
    if (members.length < 2) continue

    for (const member of members) used.add(member.key)
    result.push(mergeGroup(members))
  }

  // 組に入らなかったものを、元の順で残す
  for (const item of items) {
    if (used.has(item.key)) continue
    result.push(mergeGroup([item]))
  }

  return result
}
