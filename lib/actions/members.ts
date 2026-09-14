'use server'

import { revalidatePath } from 'next/cache'
import { isDuplicateName, normalizeName, validateName } from '@/lib/domain/member'
import { type Result, err, ok } from '@/lib/domain/result'
import { createSupabaseMemberRepository } from '@/lib/repositories/members'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * メンバーとセクションの操作。
 *
 * 重複の判定はここでも行う。データベースの一意制約でも弾けるが、
 * その場合は英語の制約違反しか返らず、利用者に理由が伝わらない。
 */

async function context() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

function refresh(projectId: string): void {
  revalidatePath(`/projects/${projectId}/members`)
  revalidatePath(`/projects/${projectId}/schedule`)
  revalidatePath(`/projects/${projectId}/tasks`)
}

export async function addMemberAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const raw = String(formData.get('name') ?? '')
  const invalid = validateName(raw)
  if (invalid) return err('VALIDATION_ERROR', invalid)

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const repository = createSupabaseMemberRepository(supabase)

  try {
    const existing = await repository.listMembers(projectId)
    if (isDuplicateName(raw, existing)) {
      return err('VALIDATION_ERROR', '同じ名前のメンバーがすでにいます。')
    }

    await repository.addMember(projectId, normalizeName(raw))
  } catch {
    return err('UNKNOWN', 'メンバーを追加できませんでした。')
  }

  refresh(projectId)
  return ok(null)
}

export async function renameMemberAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const memberId = String(formData.get('memberId') ?? '')
  if (!projectId || !memberId) {
    return err('VALIDATION_ERROR', '対象が指定されていません。')
  }

  const raw = String(formData.get('name') ?? '')
  const invalid = validateName(raw)
  if (invalid) return err('VALIDATION_ERROR', invalid)

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const repository = createSupabaseMemberRepository(supabase)

  try {
    const existing = await repository.listMembers(projectId)
    // 自分自身は重複に数えない。改名せずに保存しても弾かれないように
    if (isDuplicateName(raw, existing, memberId)) {
      return err('VALIDATION_ERROR', '同じ名前のメンバーがすでにいます。')
    }

    await repository.renameMember(memberId, normalizeName(raw))
  } catch {
    return err('UNKNOWN', 'メンバーの名前を変更できませんでした。')
  }

  refresh(projectId)
  return ok(null)
}

export async function removeMemberAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const memberId = String(formData.get('memberId') ?? '')
  if (!projectId || !memberId) {
    return err('VALIDATION_ERROR', '対象が指定されていません。')
  }

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseMemberRepository(supabase).removeMember(memberId)
  } catch {
    return err('UNKNOWN', 'メンバーを削除できませんでした。')
  }

  refresh(projectId)
  return ok(null)
}

export async function addSectionAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  if (!projectId) return err('VALIDATION_ERROR', 'プロジェクトが指定されていません。')

  const raw = String(formData.get('name') ?? '')
  const invalid = validateName(raw)
  if (invalid) return err('VALIDATION_ERROR', invalid)

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const repository = createSupabaseMemberRepository(supabase)

  try {
    const existing = await repository.listSections(projectId)
    if (isDuplicateName(raw, existing)) {
      return err('VALIDATION_ERROR', '同じ名前のセクションがすでにあります。')
    }

    await repository.addSection(projectId, normalizeName(raw))
  } catch {
    return err('UNKNOWN', 'セクションを追加できませんでした。')
  }

  refresh(projectId)
  return ok(null)
}

export async function renameSectionAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const sectionId = String(formData.get('sectionId') ?? '')
  if (!projectId || !sectionId) {
    return err('VALIDATION_ERROR', '対象が指定されていません。')
  }

  const raw = String(formData.get('name') ?? '')
  const invalid = validateName(raw)
  if (invalid) return err('VALIDATION_ERROR', invalid)

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const repository = createSupabaseMemberRepository(supabase)

  try {
    const existing = await repository.listSections(projectId)
    if (isDuplicateName(raw, existing, sectionId)) {
      return err('VALIDATION_ERROR', '同じ名前のセクションがすでにあります。')
    }

    await repository.renameSection(sectionId, normalizeName(raw))
  } catch {
    return err('UNKNOWN', 'セクションの名前を変更できませんでした。')
  }

  refresh(projectId)
  return ok(null)
}

export async function removeSectionAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const sectionId = String(formData.get('sectionId') ?? '')
  if (!projectId || !sectionId) {
    return err('VALIDATION_ERROR', '対象が指定されていません。')
  }

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  try {
    await createSupabaseMemberRepository(supabase).removeSection(sectionId)
  } catch {
    return err('UNKNOWN', 'セクションを削除できませんでした。')
  }

  refresh(projectId)
  return ok(null)
}

/** 所属の付け外し。`assign` が 'true' なら付ける */
export async function toggleSectionAction(formData: FormData): Promise<Result<null>> {
  const projectId = String(formData.get('projectId') ?? '')
  const memberId = String(formData.get('memberId') ?? '')
  const sectionId = String(formData.get('sectionId') ?? '')
  if (!projectId || !memberId || !sectionId) {
    return err('VALIDATION_ERROR', '対象が指定されていません。')
  }

  const assign = String(formData.get('assign') ?? '') === 'true'

  const { supabase, user } = await context()
  if (!user) return err('UNAUTHENTICATED', 'ログインが必要です。')

  const repository = createSupabaseMemberRepository(supabase)

  try {
    if (assign) {
      await repository.assignSection(memberId, sectionId)
    } else {
      await repository.unassignSection(memberId, sectionId)
    }
  } catch {
    return err('UNKNOWN', '所属を変更できませんでした。')
  }

  refresh(projectId)
  return ok(null)
}
