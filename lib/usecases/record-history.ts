import { getExtension } from '@/lib/domain/files'
import { type HistoryAction, buildChangeSet } from '@/lib/domain/history'
import type { HistoryRepository } from '@/lib/repositories/history'

export type RecordInput = {
  projectId: string
  fileId: string | null
  fileName: string
  fileKind: string
  action: HistoryAction
  version: number | null
  /** 変更前の本文。新規作成なら空 */
  before: string
  /** 変更後の本文。削除なら空 */
  after: string
  authorId: string | null
  authorName: string
}

/**
 * 変更履歴を 1 件記録する。
 *
 * **例外を握りつぶす。** 履歴が残せないことを理由に、
 * 保存や削除そのものが失敗するのは本末転倒であるため。
 * 記録できなかった変更は履歴に出ないが、ファイルの操作自体は成立する。
 */
export async function recordHistory(
  repository: HistoryRepository,
  input: RecordInput,
): Promise<void> {
  try {
    const changeSet = buildChangeSet(input.before, input.after)

    await repository.record({
      projectId: input.projectId,
      fileId: input.fileId,
      fileName: input.fileName,
      fileExtension: getExtension(input.fileName),
      fileKind: input.fileKind,
      action: input.action,
      version: input.version,
      changes: changeSet.changes,
      addedCount: changeSet.addedCount,
      removedCount: changeSet.removedCount,
      truncated: changeSet.truncated,
      authorId: input.authorId,
      authorName: input.authorName,
    })
  } catch {
    // 履歴が残せなくても、呼び出し元の操作は成功させる
  }
}
