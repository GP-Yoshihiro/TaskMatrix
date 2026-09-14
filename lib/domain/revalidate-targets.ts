/**
 * 更新したあとに作り直す画面の一覧。
 *
 * 1 つの更新は、1 つの画面にしか影響しないとは限らない。
 * たとえばタスクの担当を変えると、予定のガントチャートの色分けと
 * 並べ替えも変わる。更新した画面だけを作り直すと、
 * **別の画面を開いたときに古いまま**になる。
 *
 * 影響先をここにまとめる。操作ごとに書き並べると、
 * 新しい画面を足したときに入れ忘れが起きる。
 */

/** 何を更新したか */
export type MutationKind =
  | 'task'
  | 'file'
  | 'folder'
  | 'schedule'
  | 'member'
  | 'project'

/**
 * AI を使ったときに作り直す画面。
 *
 * 使用量の記録が増えるため、残量の表示が古いままにならないようにする。
 * 上限に達したときの知らせはホームに出るので、そちらも含める。
 */
export const AI_USAGE_PATHS = ['/settings/usage', '/dashboard'] as const

/** その更新で作り直すべき画面 */
export function pathsToRefresh(kind: MutationKind, projectId: string): string[] {
  const project = `/projects/${projectId}`

  const paths: Record<MutationKind, string[]> = {
    // 担当と想定日程はガントチャートと算出に使う
    task: [`${project}/tasks`, `${project}/schedule`],
    // 追加・編集・削除は変更履歴に記録される
    file: [project, `${project}/history`],
    folder: [project],
    // ホームは最近の動きを出す
    schedule: [`${project}/schedule`, '/dashboard'],
    // 担当の選択肢と、ガントチャートの区切りに使う
    member: [`${project}/members`, `${project}/tasks`, `${project}/schedule`],
    project: ['/projects', '/dashboard', project],
  }

  // 同じ経路を重ねて作り直さない
  return [...new Set(paths[kind])]
}
