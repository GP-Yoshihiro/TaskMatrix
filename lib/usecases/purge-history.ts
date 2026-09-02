import { PURGE_BATCH, needsPurge } from '@/lib/domain/capacity'

export interface PurgeGateway {
  /** データベース全体の使用量 */
  databaseSizeBytes(): Promise<number>
  /** ロック付きのタグが付いたファイル。これらの履歴は消さない */
  listLockedFileIds(projectId: string): Promise<string[]>
  /** 古い順に、保護対象を除いて消す。消した件数を返す */
  deleteOldest(input: {
    projectId: string
    protectedFileIds: string[]
    limit: number
  }): Promise<number>
}

/**
 * 容量が上限に近づいたときだけ、古い履歴を消す。
 *
 * 期限では消さない。プロジェクト始動時まで遡れることを優先し、
 * 書き込めなくなる手前でだけ手を入れる。
 *
 * **ロック付きのタグが付いたファイルの履歴は消さない。**
 * 利用者が意図して守った記録を、容量の都合で失わせないため。
 */
export async function purgeHistory(
  gateway: PurgeGateway,
  projectId: string,
): Promise<{ removed: number; usedBytes: number }> {
  const usedBytes = await gateway.databaseSizeBytes()

  if (!needsPurge(usedBytes)) return { removed: 0, usedBytes }

  const protectedFileIds = await gateway.listLockedFileIds(projectId)

  const removed = await gateway.deleteOldest({
    projectId,
    protectedFileIds,
    limit: PURGE_BATCH,
  })

  return { removed, usedBytes }
}
