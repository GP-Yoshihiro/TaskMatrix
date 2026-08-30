import { type Result, err, ok } from './result'

/** 1 ユーザーが保有できるプロジェクトの上限 */
export const MAX_PROJECTS_PER_USER = 20

/** プロジェクト名の最大文字数 */
export const PROJECT_NAME_MAX_LENGTH = 100

export function canCreateProject(currentCount: number): boolean {
  return currentCount < MAX_PROJECTS_PER_USER
}

export function validateProjectName(name: string): Result<string> {
  const trimmed = name.trim()

  if (trimmed.length === 0) {
    return err('VALIDATION_ERROR', 'プロジェクト名を入力してください。')
  }

  if (trimmed.length > PROJECT_NAME_MAX_LENGTH) {
    return err(
      'VALIDATION_ERROR',
      `プロジェクト名は ${PROJECT_NAME_MAX_LENGTH} 文字以内で入力してください。`,
    )
  }

  return ok(trimmed)
}
