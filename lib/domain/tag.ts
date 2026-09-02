/**
 * タグ。
 *
 * ファイルごとに付ける。履歴の絞り込みと、消したくないファイルの保護に使う。
 */

export const MAX_TAG_NAME_LENGTH = 20

/** 1 ファイルに付けられる数。多すぎると一覧で読めなくなる */
export const MAX_TAGS_PER_FILE = 10

export type Tag = {
  id: string
  name: string
  /** 付いたファイルを削除させず、容量削減の対象からも外す */
  locked: boolean
}

/**
 * 表記を揃える。
 * 「設計 」と「設計」が別のタグとして増えるのを防ぐ。
 */
export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function validateTagName(name: string): string | null {
  const normalized = normalizeTagName(name)

  if (normalized.length === 0) return 'タグ名を入力してください。'
  if (normalized.length > MAX_TAG_NAME_LENGTH) {
    return `タグ名は ${MAX_TAG_NAME_LENGTH} 文字以内で入力してください。`
  }

  return null
}

/**
 * このファイルを削除してよいか。
 * ロック付きのタグが 1 つでもあれば削除させない。
 */
export function canDeleteFile(tags: Tag[]): boolean {
  return !tags.some((tag) => tag.locked)
}

/** 削除できない理由。どのタグが止めているかまで伝える */
export function describeLockReason(tags: Tag[]): string {
  const locked = tags.filter((tag) => tag.locked).map((tag) => tag.name)

  if (locked.length === 0) return ''

  return `「${locked.join('」「')}」が付いているため削除できません。`
}
