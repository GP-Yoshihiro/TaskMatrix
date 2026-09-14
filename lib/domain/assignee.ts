/**
 * 担当の解決。
 *
 * 担当は 2 つの持ち方がある。
 *
 * - **名簿のメンバー**（`assignee_member_id`）— 表記が揃い、所属も辿れる
 * - **自由入力の文字**（`assignee`）— 名簿に無い人を入れられる
 *
 * どちらも残す。名簿を作る前のデータがあり、
 * 外注など名簿に載せない相手もいるため。
 */

/** 担当が決まっていないときの表示 */
export const NO_ASSIGNEE = '未設定'

export type AssigneeSource = {
  /** 選ばれているメンバーの名前。選ばれていなければ null */
  memberName: string | null
  /** 自由入力の文字 */
  freeText: string
}

/**
 * 表示・並べ替えに使う担当名を決める。
 *
 * メンバーを優先する。名簿のほうが表記が揃っており、
 * 同じ人が別の行に分かれない。
 */
export function resolveAssignee(source: AssigneeSource): string {
  const member = (source.memberName ?? '').trim()
  if (member.length > 0) return member

  const free = source.freeText.trim()
  if (free.length > 0) return free

  return NO_ASSIGNEE
}

/** 担当が決まっているか */
export function hasAssignee(source: AssigneeSource): boolean {
  return resolveAssignee(source) !== NO_ASSIGNEE
}
