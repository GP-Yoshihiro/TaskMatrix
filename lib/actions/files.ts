'use server'

import { revalidatePath } from 'next/cache'
import { buildStoragePath, normalizeLineEndings, validateUpload } from '@/lib/domain/files'
import { type Result, err, ok } from '@/lib/domain/result'
import { createSupabaseFileRepository } from '@/lib/repositories/files'
import { createSupabaseHistoryRepository } from '@/lib/repositories/history'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { readAuthorName } from '@/lib/usecases/current-author'
import { recordHistory } from '@/lib/usecases/record-history'

const BUCKET = 'project-files'

export async function uploadFileAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const folderIdRaw = String(formData.get('folderId') ?? '')
  const folderId = folderIdRaw === '' ? null : folderIdRaw
  const file = formData.get('file')

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')
  if (!(file instanceof File)) return err('VALIDATION_ERROR', 'ファイルを選択してください。')

  const validated = validateUpload({ name: file.name, size: file.size })
  if (!validated.ok) return validated

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const repo = createSupabaseFileRepository(supabase)

  try {
    const isText = validated.data.kind !== 'binary'
    const created = await repo.create({
      projectId,
      folderId,
      name: validated.data.name,
      kind: validated.data.kind,
      mimeType: file.type,
      size: file.size,
      storagePath: null,
      createdBy: user.id,
    })

    // 履歴に残す本文。バイナリは中身を読まない（更新の経路が無く差分が生じないため）
    let uploadedText = ''

    if (isText) {
      const content = normalizeLineEndings(await file.text())
      uploadedText = content
      const size = new TextEncoder().encode(content).length
      const { error } = await supabase.from('file_versions').insert({
        file_id: created.id,
        version: 1,
        content,
        size,
        author_id: user.id,
        note: 'アップロード',
      })
      if (error) throw error
    } else {
      const path = buildStoragePath({
        projectId,
        fileId: created.id,
        version: 1,
        filename: validated.data.name,
      })
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined })

      if (uploadError) {
        await repo.remove(created.id)
        return err('STORAGE_ERROR', 'ファイルの保存に失敗しました。')
      }

      await repo.updateForNewVersion({
        id: created.id,
        version: 1,
        size: file.size,
        storagePath: path,
      })

      const { error } = await supabase.from('file_versions').insert({
        file_id: created.id,
        version: 1,
        storage_path: path,
        size: file.size,
        author_id: user.id,
        note: 'アップロード',
      })
      if (error) throw error
    }

    await recordHistory(createSupabaseHistoryRepository(supabase), {
      projectId,
      fileId: created.id,
      fileName: validated.data.name,
      fileKind: validated.data.kind,
      action: 'created',
      version: 1,
      before: '',
      after: uploadedText,
      authorId: user.id,
      authorName: await readAuthorName(supabase, user.id),
    })
  } catch {
    return err('UNKNOWN', 'ファイルを登録できませんでした。')
  }

  revalidatePath(`/projects/${projectId}`)
  return ok(null)
}

export async function deleteFileAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のファイルが指定されていません。')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const files = createSupabaseFileRepository(supabase)

  try {
    // 消してしまうと何を消したのか分からなくなるため、先に読んでおく
    const target = await files.findById(id)
    const lastContent =
      target && target.kind !== 'binary'
        ? ((
            await supabase
              .from('file_versions')
              .select('content')
              .eq('file_id', id)
              .eq('version', target.currentVersion)
              .maybeSingle()
          ).data as { content: string | null } | null)?.content ?? ''
        : ''

    const { data } = await supabase
      .from('file_versions')
      .select('storage_path')
      .eq('file_id', id)

    const paths = (data ?? [])
      .map((row) => (row as { storage_path: string | null }).storage_path)
      .filter((path): path is string => Boolean(path))

    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths)
    }

    await files.remove(id)

    // 履歴はファイルから独立しているため、ファイルを消しても残る
    await recordHistory(createSupabaseHistoryRepository(supabase), {
      projectId,
      fileId: id,
      fileName: target?.name ?? '(不明なファイル)',
      fileKind: target?.kind ?? '',
      action: 'deleted',
      version: target?.currentVersion ?? null,
      before: lastContent,
      after: '',
      authorId: user.id,
      authorName: await readAuthorName(supabase, user.id),
    })
  } catch {
    return err('UNKNOWN', 'ファイルを削除できませんでした。')
  }

  revalidatePath(`/projects/${projectId}`)
  return ok(null)
}

/**
 * ダウンロード用の署名付きURLを 60 秒だけ発行する。
 * Storage のキーは ASCII に正規化されているため、
 * 元の表示名を download に指定して復元する。
 */
export async function createDownloadUrlAction(
  storagePath: string,
  displayName: string,
): Promise<Result<string>> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60, { download: displayName })

  if (error || !data) {
    return err('STORAGE_ERROR', 'ダウンロードURLを発行できませんでした。')
  }

  return ok(data.signedUrl)
}
