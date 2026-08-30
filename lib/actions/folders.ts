'use server'

import { revalidatePath } from 'next/cache'
import { validateFolderName } from '@/lib/domain/folders'
import { type Result, err, ok } from '@/lib/domain/result'
import { createSupabaseFolderRepository } from '@/lib/repositories/folders'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function createFolderAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const parentIdRaw = String(formData.get('parentId') ?? '')
  const parentId = parentIdRaw === '' ? null : parentIdRaw

  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const validated = validateFolderName(String(formData.get('name') ?? ''))
  if (!validated.ok) return validated

  const supabase = await createServerSupabaseClient()
  try {
    await createSupabaseFolderRepository(supabase).create({
      projectId,
      parentId,
      name: validated.data,
    })
  } catch {
    return err('UNKNOWN', 'フォルダを作成できませんでした。')
  }

  revalidatePath(`/projects/${projectId}`)
  return ok(null)
}

export async function deleteFolderAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のフォルダが指定されていません。')

  const supabase = await createServerSupabaseClient()
  try {
    await createSupabaseFolderRepository(supabase).remove(id)
  } catch {
    return err('UNKNOWN', 'フォルダを削除できませんでした。')
  }

  revalidatePath(`/projects/${projectId}`)
  return ok(null)
}
