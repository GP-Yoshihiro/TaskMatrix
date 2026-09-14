/**
 * ガントチャートの並べ替えと区切り。
 *
 * 工程を担当ごと・セクションごとにまとめて見出しで区切る。
 * 工程が増えると、どれが誰の受け持ちかを行ごとに読むのが難しくなるため。
 *
 * **複属のメンバーは、最初の所属にだけ出す。**
 * 所属する全ての見出しに出すと、工程の合計件数が見出しの合計と一致せず、
 * 「どこかで二重に数えている」と誤解させる。
 * 他の所属は、名前を押したときに見せる。
 */

import { UNASSIGNED_SECTION } from './member'

export type GanttSort = 'start' | 'assignee' | 'section'

export const GANTT_SORTS: { value: GanttSort; label: string }[] = [
  { value: 'start', label: '開始日順' },
  { value: 'assignee', label: '担当ごと' },
  { value: 'section', label: 'セクションごと' },
]

/** 区切りに必要な最小限。棒の中身には触らない */
type Groupable = {
  key: string
  label: string
  assignee: string
}

export type GanttGroup<T> = {
  /** 見出しの識別子 */
  key: string
  /** 見出しの文字。開始日順のときは空 */
  label: string
  count: number
  rows: T[]
}

/** 担当名から所属セクションを引く表。先頭が「最初の所属」 */
export type SectionsByAssignee = Record<string, string[]>

/**
 * 見出しで区切る。
 *
 * 見出しの並びは**最初に出てきた順**とする。
 * 名前順にすると、上から読んだときの流れと合わない。
 */
export function groupGanttRows<T extends Groupable>(
  rows: T[],
  sort: GanttSort,
  sections: SectionsByAssignee,
): GanttGroup<T>[] {
  if (rows.length === 0) return []

  // 区切らない。並べ替えはガントチャート側ですでに開始順になっている
  if (sort === 'start') {
    return [{ key: 'all', label: '', count: rows.length, rows }]
  }

  const groups = new Map<string, GanttGroup<T>>()

  for (const row of rows) {
    const label =
      sort === 'assignee' ? row.assignee : primarySectionName(row.assignee, sections)

    const existing = groups.get(label)
    if (existing) {
      existing.rows.push(row)
      existing.count += 1
    } else {
      groups.set(label, { key: label, label, count: 1, rows: [row] })
    }
  }

  return [...groups.values()]
}

/** その担当の「最初の所属」。無ければ未設定 */
function primarySectionName(assignee: string, sections: SectionsByAssignee): string {
  return sections[assignee]?.[0] ?? UNASSIGNED_SECTION
}

/**
 * 最初の所属を除いた、残りの所属。
 *
 * 既定では隠し、名前を押したときにこれを出す。
 */
export function otherSectionsOf(assignee: string, sections: SectionsByAssignee): string[] {
  return (sections[assignee] ?? []).slice(1)
}
