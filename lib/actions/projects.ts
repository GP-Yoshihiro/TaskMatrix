'use server'

import { revalidatePath } from 'next/cache'
import { validateProjectName } from '@/lib/domain/projects'
import { type Result, err, ok } from '@/lib/domain/result'
import { createSupabaseProjectRepository } from '@/lib/repositories/projects'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createProject } from '@/lib/usecases/projects'

async function currentContext() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function createProjectAction(formData: FormData): Promise<Result<null>> {
  const { supabase, user } = await currentContext()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const repo = createSupabaseProjectRepository(supabase)

  try {
    const result = await createProject(repo, user.id, String(formData.get('name') ?? ''))
    if (!result.ok) return result
  } catch {
    return err('UNKNOWN', 'プロジェクトを作成できませんでした。')
  }

  revalidatePath('/projects')
  return ok(null)
}

export async function renameProjectAction(formData: FormData): Promise<Result<null>> {
  const { supabase, user } = await currentContext()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const validated = validateProjectName(String(formData.get('name') ?? ''))
  if (!validated.ok) return validated

  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のプロジェクトが指定されていません。')

  try {
    await createSupabaseProjectRepository(supabase).rename(id, validated.data)
  } catch {
    return err('UNKNOWN', 'プロジェクト名を変更できませんでした。')
  }

  revalidatePath('/projects')
  return ok(null)
}

export async function deleteProjectAction(formData: FormData): Promise<Result<null>> {
  const { supabase, user } = await currentContext()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const id = String(formData.get('id') ?? '')
  if (!id) return err('VALIDATION_ERROR', '対象のプロジェクトが指定されていません。')

  try {
    await createSupabaseProjectRepository(supabase).remove(id)
  } catch {
    return err('UNKNOWN', 'プロジェクトを削除できませんでした。')
  }

  revalidatePath('/projects')
  return ok(null)
}
