'use server'

import { revalidatePath } from 'next/cache'
import { type Result, err, ok } from '@/lib/domain/result'
import { MAX_TAGS_PER_FILE, type Tag, normalizeTagName, validateTagName } from '@/lib/domain/tag'
import { createSupabaseTagRepository } from '@/lib/repositories/tags'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function context() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/**
 * タグを付ける。同名があれば作らずに使い回す。
 * 表記ゆれで同じ意味のタグが増えるのを防ぐ。
 */
export async function attachTagAction(formData: FormData): Promise<Result<Tag>> {
  const projectId = String(formData.get('projectId') ?? '')
  const fileId = String(formData.get('fileId') ?? '')
  const rawName = String(formData.get('name') ?? '')
  const locked = String(formData.get('locked') ?? '') === 'on'

  if (!projectId || !fileId) {
    return err('VALIDATION_ERROR', '対象が指定されていません。')
  }

  const message = validateTagName(rawName)
  if (message) return err('VALIDATION_ERROR', message)

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const tags = createSupabaseTagRepository(supabase)

  try {
    const current = await tags.listByFile(fileId)
    if (current.length >= MAX_TAGS_PER_FILE) {
      return err(
        'VALIDATION_ERROR',
        `1 つのファイルに付けられるタグは ${MAX_TAGS_PER_FILE} 個までです。`,
      )
    }

    const tag = await tags.findOrCreate({
      projectId,
      name: normalizeTagName(rawName),
      locked,
    })

    await tags.attach(fileId, tag.id)

    revalidatePath(`/projects/${projectId}/files/${fileId}`)
    revalidatePath(`/projects/${projectId}/history`)
    return ok(tag)
  } catch {
    return err('UNKNOWN', 'タグを付けられませんでした。')
  }
}

/** タグを外す。タグ自体は残す（他のファイルが使っている可能性があるため） */
export async function detachTagAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const fileId = String(formData.get('fileId') ?? '')
  const tagId = String(formData.get('tagId') ?? '')

  if (!fileId || !tagId) return err('VALIDATION_ERROR', '対象が指定されていません。')

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseTagRepository(supabase).detach(fileId, tagId)

    revalidatePath(`/projects/${projectId}/files/${fileId}`)
    revalidatePath(`/projects/${projectId}/history`)
    return ok(null)
  } catch {
    return err('UNKNOWN', 'タグを外せませんでした。')
  }
}
