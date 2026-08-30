import { type Result, err, ok } from './result'

export type FolderRow = {
  id: string
  name: string
  parentId: string | null
}

export type FolderNode = FolderRow & { children: FolderNode[] }

/** フォルダ名の最大文字数 */
export const FOLDER_NAME_MAX_LENGTH = 100

/**
 * フラットな行の配列を階層ツリーに変換する。
 * 親が見つからない行はルートとして扱い、データ不整合でも表示できるようにする。
 */
export function buildFolderTree(rows: FolderRow[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>()
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] })
  }

  const roots: FolderNode[] = []
  for (const row of rows) {
    const node = nodes.get(row.id)!
    const parent = row.parentId ? nodes.get(row.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sortRecursively = (list: FolderNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    for (const node of list) sortRecursively(node.children)
  }
  sortRecursively(roots)

  return roots
}

export function validateFolderName(name: string): Result<string> {
  const trimmed = name.trim()

  if (trimmed.length === 0) {
    return err('VALIDATION_ERROR', 'フォルダ名を入力してください。')
  }

  if (/[/\\]/.test(trimmed)) {
    return err('VALIDATION_ERROR', 'フォルダ名に / や \\ は使用できません。')
  }

  if (trimmed.length > FOLDER_NAME_MAX_LENGTH) {
    return err(
      'VALIDATION_ERROR',
      `フォルダ名は ${FOLDER_NAME_MAX_LENGTH} 文字以内で入力してください。`,
    )
  }

  return ok(trimmed)
}
