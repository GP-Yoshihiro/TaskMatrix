/**
 * アカウントの削除。
 *
 * 取り消せない操作のため、押し間違いで実行されないようにする。
 * 「削除しますか？」の確認だけでは、流れで押してしまう。
 * 自分のメールアドレスを打たせることで、意図を確かめる。
 */

/**
 * 入力が本人のメールアドレスと一致するか。
 *
 * 前後の空白は落とし、大文字小文字は区別しない。
 * 打ち間違いではなく「見た目の違い」で弾くのは、意図の確認にならないため。
 */
export function matchesConfirmation(input: string, email: string): boolean {
  const typed = input.trim().toLowerCase()
  const expected = email.trim().toLowerCase()

  if (expected.length === 0) return false

  return typed === expected
}

/** 削除しても消えないものの案内。実行前に必ず伝える */
export const DELETION_NOTICE = [
  'プロジェクト・ファイル・タスク・予定・変更履歴がすべて削除されます。',
  'Google カレンダーに作られたカレンダーと予定は、Google 側に残ります。',
  '削除したデータは復元できません。',
] as const
