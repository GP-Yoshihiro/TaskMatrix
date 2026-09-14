/**
 * プロジェクトのメンバーとセクション。
 *
 * メンバーは**名簿**であり、利用者アカウントとは結び付けない。
 * 担当を自由入力の文字列のままにすると、表記ゆれで同じ人が
 * 別の行に分かれ、並べ替えの基準にできない。
 */

/** 名前の上限。長いと見出しからあふれ、並べ替えの区切りが読めなくなる */
export const MAX_NAME_LENGTH = 40

/** 所属が決まっていないときの見出し */
export const UNASSIGNED_SECTION = '未設定'

export type SectionRef = {
  id: string
  name: string
}

/**
 * 名前をそろえる。
 *
 * 前後の空白を落とし、間の空白は 1 つにまとめる。
 * 全角の空白も空白として扱う。
 * 「田中　太郎」と「田中  太郎」を別人にしないため。
 */
export function normalizeName(input: string): string {
  return input.replace(/[\s　]+/g, ' ').trim()
}

/** 名前として使えるか。使えないときは理由を返す */
export function validateName(input: string): string | null {
  const name = normalizeName(input)

  if (name.length === 0) return '名前を入力してください。'
  if (name.length > MAX_NAME_LENGTH) {
    return `名前は ${MAX_NAME_LENGTH} 文字までにしてください。`
  }

  return null
}

/**
 * すでに同じ名前があるか。
 *
 * `selfId` を渡すと、その行は数えない。
 * 改名しないまま保存したときに、自分自身と重複して弾かれるのを防ぐ。
 */
export function isDuplicateName(
  input: string,
  existing: { id: string; name: string }[],
  selfId?: string,
): boolean {
  const name = normalizeName(input)

  return existing.some((item) => {
    if (item.id === selfId) return false
    return normalizeName(item.name) === name
  })
}

/**
 * 複属のときに出す所属を 1 つ選ぶ。
 *
 * 所属する全ての見出しに出すと、工程の合計件数が見出しの合計と
 * 一致しなくなり、「どこかで二重に数えている」と誤解させる。
 * 既定は最初の所属のみとし、他の所属は名前を押したときに見せる。
 */
export function primarySectionOf(sections: SectionRef[]): SectionRef {
  return sections[0] ?? { id: '', name: UNASSIGNED_SECTION }
}
