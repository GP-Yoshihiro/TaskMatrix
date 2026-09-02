'use server'

import { revalidatePath } from 'next/cache'
import { validateUpload } from '@/lib/domain/files'
import { type Result, err, ok } from '@/lib/domain/result'
import { createSupabaseFileVersionRepository } from '@/lib/repositories/file-versions'
import { createSupabaseHistoryRepository } from '@/lib/repositories/history'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { readAuthorName } from '@/lib/usecases/current-author'
import { saveMarkdown } from '@/lib/usecases/markdown'
import { recordHistory } from '@/lib/usecases/record-history'

async function context() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function createMarkdownFileAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const folderIdRaw = String(formData.get('folderId') ?? '')
  const folderId = folderIdRaw === '' ? null : folderIdRaw
  const rawName = String(formData.get('name') ?? '').trim()

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')
  if (rawName.length === 0) return err('VALIDATION_ERROR', 'メモ名を入力してください。')

  const name = rawName.endsWith('.md') ? rawName : `${rawName}.md`

  const validated = validateUpload({ name, size: 1 })
  if (!validated.ok) return validated

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    const files = createSupabaseFileRepository(supabase)
    const versions = createSupabaseFileVersionRepository(supabase)

    const created = await files.create({
      projectId,
      folderId,
      name: validated.data.name,
      kind: 'markdown',
      mimeType: 'text/markdown',
      size: 0,
      storagePath: null,
      createdBy: user.id,
    })

    await versions.create({
      fileId: created.id,
      version: 1,
      content: '',
      storagePath: null,
      size: 0,
      authorId: user.id,
      note: '新規作成',
    })

    await recordHistory(createSupabaseHistoryRepository(supabase), {
      projectId,
      fileId: created.id,
      fileName: validated.data.name,
      fileKind: 'markdown',
      action: 'created',
      version: 1,
      before: '',
      after: '',
      authorId: user.id,
      authorName: await readAuthorName(supabase, user.id),
    })

  } catch {
    return err('UNKNOWN', 'ファイルを作成できませんでした。')
  }

  revalidatePath(`/projects/${projectId}`)
  return ok(null)
}

export async function saveMarkdownAction(formData: FormData): Promise<Result<number>> {
  const projectId = String(formData.get('projectId') ?? '')
  const fileId = String(formData.get('fileId') ?? '')
  const content = String(formData.get('content') ?? '')

  if (!fileId) return err('VALIDATION_ERROR', '対象のファイルが指定されていません。')

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const files = createSupabaseFileRepository(supabase)
  const versions = createSupabaseFileVersionRepository(supabase)

  let result: Result<number>
  let before = ''
  let fileName = ''

  try {
    // 差分は保存時に計算して持つ。一覧のたびに全文を比較しないため、
    // 変更前の本文をこの時点で読んでおく
    const file = await files.findById(fileId)
    fileName = file?.name ?? ''
    if (file) {
      const current = await versions.findByVersion(fileId, file.currentVersion)
      before = current?.content ?? ''
    }

    result = await saveMarkdown({ files, versions }, { fileId, content, authorId: user.id })
  } catch {
    return err('UNKNOWN', '保存に失敗しました。')
  }

  if (result.ok) {
    await recordHistory(createSupabaseHistoryRepository(supabase), {
      projectId,
      fileId,
      fileName,
      fileKind: 'markdown',
      action: 'updated',
      version: result.data,
      before,
      after: content,
      authorId: user.id,
      authorName: await readAuthorName(supabase, user.id),
    })

    // 履歴に差分を残したので、過去版の全文はもう要らない。
    // 全文と差分の両方を持ち続けると、容量削減にならない
    try {
      await versions.deleteOlderThan(fileId, result.data)
    } catch {
      // 捨てられなくても保存は成立している
    }
  }

  if (result.ok) {
    revalidatePath(`/projects/${projectId}/files/${fileId}`)
    revalidatePath(`/projects/${projectId}`)
  }
  return result
}
