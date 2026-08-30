import { type Result, err, ok } from '@/lib/domain/result'
import type { FileVersionRepository } from '@/lib/repositories/file-versions'
import type { FileRepository } from '@/lib/repositories/files'

type Deps = { files: FileRepository; versions: FileVersionRepository }

/**
 * テキスト系ファイルの本文を新しい版として保存し、新しい版番号を返す。
 * リポジトリを引数で受け取るため Supabase なしで単体テストできる。
 */
export async function saveMarkdown(
  deps: Deps,
  input: { fileId: string; content: string; authorId: string },
): Promise<Result<number>> {
  const file = await deps.files.findById(input.fileId)
  if (!file) return err('NOT_FOUND', 'ファイルが見つかりません。')

  if (file.kind === 'binary') {
    return err('VALIDATION_ERROR', 'このファイルはアプリ内で編集できません。')
  }

  const nextVersion = file.currentVersion + 1
  const size = new TextEncoder().encode(input.content).length

  await deps.versions.create({
    fileId: file.id,
    version: nextVersion,
    content: input.content,
    storagePath: null,
    size,
    authorId: input.authorId,
    note: '編集',
  })

  await deps.files.updateForNewVersion({
    id: file.id,
    version: nextVersion,
    size,
    storagePath: null,
  })

  return ok(nextVersion)
}
