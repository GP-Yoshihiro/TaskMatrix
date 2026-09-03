import { describe, expect, it } from 'vitest'
import {
  GLOBAL_NAV,
  PROJECT_NAV,
  buildBreadcrumbs,
  isActive,
  projectIdFromPath,
  resolveHref,
} from '../navigation'

const ID = '1e1c510a-33cd-4b57-87dd-f7856e0c9039'

describe('projectIdFromPath', () => {
  it('プロジェクトの経路から ID を取り出す', () => {
    expect(projectIdFromPath(`/projects/${ID}`)).toBe(ID)
  })

  it('配下の経路からも取り出す', () => {
    expect(projectIdFromPath(`/projects/${ID}/tasks`)).toBe(ID)
    expect(projectIdFromPath(`/projects/${ID}/files/abc`)).toBe(ID)
  })

  it('プロジェクト一覧では null', () => {
    expect(projectIdFromPath('/projects')).toBeNull()
  })

  it('関係ない画面では null', () => {
    expect(projectIdFromPath('/settings')).toBeNull()
    expect(projectIdFromPath('/dashboard')).toBeNull()
  })

  it('ID の形をしていなければ null', () => {
    expect(projectIdFromPath('/projects/abc/tasks')).toBeNull()
  })
})

describe('resolveHref', () => {
  it('プロジェクト ID を差し込む', () => {
    expect(resolveHref('/projects/:projectId/tasks', ID)).toBe(`/projects/${ID}/tasks`)
  })

  it('ID が無ければそのまま', () => {
    expect(resolveHref('/settings', null)).toBe('/settings')
  })
})

describe('isActive', () => {
  it('完全に一致すれば現在地', () => {
    expect(isActive('/settings', '/settings')).toBe(true)
  })

  it('前方一致だけでは現在地としない', () => {
    // これを許すと「プロジェクト」がプロジェクト内のどこでも光り、
    // 今どこにいるのか分からなくなる
    expect(isActive(`/projects/${ID}/tasks`, '/projects')).toBe(false)
  })

  it('設定の使用量画面では設定を光らせない', () => {
    expect(isActive('/settings/usage', '/settings')).toBe(false)
  })

  it('プロジェクトの概要は配下のファイル画面でも現在地とする', () => {
    // ファイルはプロジェクトの中身なので、概要の一部と見なすのが自然
    expect(isActive(`/projects/${ID}/files/abc`, `/projects/${ID}`)).toBe(true)
  })

  it('プロジェクトの概要はタスク画面では現在地としない', () => {
    expect(isActive(`/projects/${ID}/tasks`, `/projects/${ID}`)).toBe(false)
  })

  it('タスク画面ではタスクの項目が現在地', () => {
    expect(isActive(`/projects/${ID}/tasks`, `/projects/${ID}/tasks`)).toBe(true)
  })
})

describe('buildBreadcrumbs', () => {
  it('プロジェクトの概要では、一覧とプロジェクト名を出す', () => {
    expect(
      buildBreadcrumbs({ projectId: ID, projectName: '設計資料', pageLabel: null }),
    ).toEqual([
      { label: 'プロジェクト', href: '/projects' },
      { label: '設計資料', href: undefined },
    ])
  })

  it('画面名があれば最後に足し、プロジェクト名をリンクにする', () => {
    expect(
      buildBreadcrumbs({ projectId: ID, projectName: '設計資料', pageLabel: 'タスク' }),
    ).toEqual([
      { label: 'プロジェクト', href: '/projects' },
      { label: '設計資料', href: `/projects/${ID}` },
      { label: 'タスク' },
    ])
  })

  it('最後の 1 つはリンクにしない', () => {
    // 今いる場所を押せると、押しても何も起きず戸惑わせる
    const crumbs = buildBreadcrumbs({
      projectId: ID,
      projectName: '設計資料',
      pageLabel: '要件メモ.md',
    })

    expect(crumbs[crumbs.length - 1].href).toBeUndefined()
  })

  it('プロジェクト外では画面名だけ', () => {
    expect(
      buildBreadcrumbs({ projectId: null, projectName: null, pageLabel: '設定' }),
    ).toEqual([{ label: '設定' }])
  })

  it('何も無ければ空', () => {
    expect(
      buildBreadcrumbs({ projectId: null, projectName: null, pageLabel: null }),
    ).toEqual([])
  })
})

describe('項目の定義', () => {
  it('全体の項目はプロジェクト ID を必要としない', () => {
    for (const item of GLOBAL_NAV) {
      expect(item.href).not.toContain(':projectId')
    }
  })

  it('プロジェクトの項目はすべて ID を含む', () => {
    for (const item of PROJECT_NAV) {
      expect(item.href).toContain(':projectId')
    }
  })

  it('見分けるための目印が付いている', () => {
    for (const item of [...GLOBAL_NAV, ...PROJECT_NAV]) {
      expect(item.icon.length).toBeGreaterThan(0)
    }
  })
})
