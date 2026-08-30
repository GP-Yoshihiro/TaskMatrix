import { canCreateProject, validateProjectName } from '@/lib/domain/projects'
import { type Result, err, ok } from '@/lib/domain/result'
import type { Project, ProjectRepository } from '@/lib/repositories/projects'

/**
 * プロジェクトを作成する。
 * リポジトリを引数で受け取るため、Supabase なしで単体テストできる。
 * Server Action ファイルに置くと公開エンドポイントになってしまうため、ここに置く。
 */
export async function createProject(
  repo: ProjectRepository,
  ownerId: string,
  rawName: string,
): Promise<Result<Project>> {
  const validated = validateProjectName(rawName)
  if (!validated.ok) return validated

  const count = await repo.countByOwner(ownerId)
  if (!canCreateProject(count)) {
    return err(
      'PROJECT_LIMIT_EXCEEDED',
      'プロジェクトは 20 件までです。不要なプロジェクトを削除してください。',
    )
  }

  const project = await repo.create({ ownerId, name: validated.data })
  return ok(project)
}
