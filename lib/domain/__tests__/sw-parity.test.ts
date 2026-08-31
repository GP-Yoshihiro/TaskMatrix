import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { type CacheStrategy, chooseStrategy } from '@/lib/domain/pwa'

/**
 * public/sw.js は lib/domain/pwa.ts の判定を写して持っている。
 * Service Worker は import できないため写しにせざるを得ないが、
 * ずれるとテストが実態を保証しなくなる。
 * ここで両者の判定が一致することを固定する。
 */

const ORIGIN = 'http://localhost:3000'

/** sw.js をワーカー相当の文脈で読み込み、内部の関数と定数を取り出す */
function loadServiceWorker() {
  const source = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8')

  const listeners: Record<string, unknown> = {}
  const sandbox = {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, handler: unknown) => {
        listeners[type] = handler
      },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
    },
    caches: {},
    fetch: () => Promise.resolve(),
    URL,
    Response: class {},
    Promise,
    console,
    __result: {} as Record<string, unknown>,
  }

  const context = createContext(sandbox)
  runInContext(
    `${source}\n__result.chooseStrategy = chooseStrategy; __result.APP_SHELL = APP_SHELL; __result.CACHE_NAME = CACHE_NAME;`,
    context,
  )

  return {
    chooseStrategy: sandbox.__result.chooseStrategy as (request: {
      method: string
      url: string
      mode: string
    }) => CacheStrategy,
    appShell: sandbox.__result.APP_SHELL as string[],
    cacheName: sandbox.__result.CACHE_NAME as string,
    listeners,
  }
}

const cases: { label: string; request: { method: string; url: string; mode: string } }[] = [
  { label: 'POST', request: { method: 'POST', url: `${ORIGIN}/projects`, mode: 'cors' } },
  { label: 'PUT', request: { method: 'PUT', url: `${ORIGIN}/projects`, mode: 'cors' } },
  { label: 'DELETE', request: { method: 'DELETE', url: `${ORIGIN}/x`, mode: 'cors' } },
  {
    label: 'ページ遷移',
    request: { method: 'GET', url: `${ORIGIN}/dashboard`, mode: 'navigate' },
  },
  {
    label: 'ビルド成果物',
    request: { method: 'GET', url: `${ORIGIN}/_next/static/chunks/a.js`, mode: 'cors' },
  },
  {
    label: 'アイコン',
    request: { method: 'GET', url: `${ORIGIN}/icons/icon-192.png`, mode: 'cors' },
  },
  {
    label: 'manifest',
    request: { method: 'GET', url: `${ORIGIN}/manifest.webmanifest`, mode: 'cors' },
  },
  {
    label: 'API',
    request: { method: 'GET', url: `${ORIGIN}/api/projects/x/schedule.ics`, mode: 'cors' },
  },
  {
    label: 'APIへの遷移',
    request: { method: 'GET', url: `${ORIGIN}/api/x`, mode: 'navigate' },
  },
  {
    label: '別オリジン(Supabase)',
    request: {
      method: 'GET',
      url: 'https://patasstmipeqaaovfihv.supabase.co/rest/v1/tasks',
      mode: 'cors',
    },
  },
  {
    label: '別オリジン(Gemini)',
    request: {
      method: 'GET',
      url: 'https://generativelanguage.googleapis.com/v1beta/x',
      mode: 'cors',
    },
  },
  {
    label: '未知のパス',
    request: { method: 'GET', url: `${ORIGIN}/unknown.txt`, mode: 'cors' },
  },
]

describe('sw.js と lib/domain/pwa.ts の一致', () => {
  const sw = loadServiceWorker()

  it('sw.js が構文として正しく読み込める', () => {
    expect(typeof sw.chooseStrategy).toBe('function')
  })

  it('必要なイベントを登録している', () => {
    expect(Object.keys(sw.listeners).sort()).toEqual(['activate', 'fetch', 'install'])
  })

  it('キャッシュ名にバージョンが付いている', () => {
    expect(sw.cacheName).toMatch(/-v\d+$/)
  })

  for (const testCase of cases) {
    it(`判定が一致する: ${testCase.label}`, () => {
      expect(sw.chooseStrategy(testCase.request)).toBe(chooseStrategy(testCase.request))
    })
  }

  it('APP_SHELL の内容が一致する', async () => {
    const { APP_SHELL } = await import('@/lib/domain/pwa')
    expect([...sw.appShell].sort()).toEqual([...APP_SHELL].sort())
  })

  it('sw.js の APP_SHELL にも利用者データの経路が入っていない', () => {
    for (const path of sw.appShell) {
      expect(path.startsWith('/projects')).toBe(false)
      expect(path.startsWith('/dashboard')).toBe(false)
      expect(path.startsWith('/api')).toBe(false)
      expect(path.startsWith('/settings')).toBe(false)
    }
  })
})
