/**
 * 画面の移動先と現在地の判定。
 *
 * 現在地が分からないと「今どこにいるか」が掴めず、
 * 同じ画面を何度も開き直すことになる。
 */

export type NavItem = {
  /** サイドバーに出す名前 */
  label: string
  /** 移動先。プロジェクト内の項目は `:projectId` を含む */
  href: string
  /** 目印。文字だけより形で見分けられる */
  icon: string
}

/** どの画面でも出す項目 */
export const GLOBAL_NAV: NavItem[] = [
  { label: 'ホーム', href: '/dashboard', icon: '🏠' },
  { label: 'プロジェクト', href: '/projects', icon: '📁' },
  { label: '設定', href: '/settings', icon: '⚙️' },
]

/** プロジェクトを開いている間だけ出す項目 */
export const PROJECT_NAV: NavItem[] = [
  { label: '概要', href: '/projects/:projectId', icon: '📄' },
  { label: 'タスク', href: '/projects/:projectId/tasks', icon: '✅' },
  { label: '予定', href: '/projects/:projectId/schedule', icon: '🗓️' },
  { label: 'AI チャット', href: '/projects/:projectId/chat', icon: '💬' },
  { label: '変更履歴', href: '/projects/:projectId/history', icon: '🕘' },
]

const PROJECT_PATH = /^\/projects\/([0-9a-fA-F-]{36})(\/|$)/

/** 経路からプロジェクト ID を取り出す。プロジェクト内でなければ null */
export function projectIdFromPath(pathname: string): string | null {
  return PROJECT_PATH.exec(pathname)?.[1] ?? null
}

export function resolveHref(href: string, projectId: string | null): string {
  return projectId ? href.replace(':projectId', projectId) : href
}

/**
 * その項目が現在地かどうか。
 *
 * 単純な前方一致にすると `/projects` が `/projects/xxx/tasks` でも光ってしまい、
 * どこにいるのか分からなくなる。プロジェクトの「概要」だけは、
 * 配下のファイル画面も自分の中と見なす。
 */
export function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true

  // プロジェクトの概要は、その配下のファイル画面も自分の中とする
  const projectId = projectIdFromPath(href)
  if (projectId && href === `/projects/${projectId}`) {
    return pathname.startsWith(`${href}/files/`)
  }

  return false
}

export type Crumb = {
  label: string
  /** 最後の 1 つはリンクにしない（今いる場所のため） */
  href?: string
}

/**
 * パンくずを組み立てる。
 * 「どこの何を見ているか」を 1 行で示す。
 */
export function buildBreadcrumbs(input: {
  projectId: string | null
  projectName: string | null
  /** その画面の名前（「タスク」「要件メモ.md」など） */
  pageLabel: string | null
}): Crumb[] {
  const crumbs: Crumb[] = []

  if (input.projectId && input.projectName) {
    crumbs.push({ label: 'プロジェクト', href: '/projects' })
    crumbs.push({
      label: input.projectName,
      href: input.pageLabel ? `/projects/${input.projectId}` : undefined,
    })
  }

  if (input.pageLabel) crumbs.push({ label: input.pageLabel })

  return crumbs
}
