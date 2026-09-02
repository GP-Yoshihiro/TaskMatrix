/**
 * 変更者名の決め方。
 *
 * 表示名を登録していればそれを使う。改名すると過去の履歴にも反映される。
 * アカウントが消えていれば、記録時に焼き込んだ名前を使う。
 * どちらも無ければメールアドレスの @ より前を使う。
 */
export function resolveAuthorName(input: {
  /** profiles.display_name。アカウントが消えていれば null */
  displayName: string | null
  /** profiles.email。アカウントが消えていれば null */
  email: string | null
  /** 履歴に焼き込んだ記録時点の名前 */
  snapshot: string
}): string {
  const displayName = input.displayName?.trim() ?? ''
  if (displayName) return displayName

  const email = input.email?.trim() ?? ''
  if (email) {
    const local = email.split('@')[0]
    if (local) return local
  }

  const snapshot = input.snapshot.trim()
  if (snapshot) return snapshot

  return '不明'
}

/** 表示名の上限。1 行に収める一覧で長すぎる名前は扱えない */
export const MAX_DISPLAY_NAME_LENGTH = 30

export function validateDisplayName(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return `表示名は ${MAX_DISPLAY_NAME_LENGTH} 文字以内で入力してください。`
  }
  return null
}
