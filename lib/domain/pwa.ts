export type CacheStrategy = 'network-first' | 'cache-first' | 'passthrough'

/**
 * Service Worker が事前に取得しておく資源。
 * **利用者のデータを含む経路を入れてはいけない。**
 * 古いデータを最新のように見せてしまうため。
 */
export const APP_SHELL = [
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
] as const

const CACHE_FIRST_PREFIXES = ['/_next/static/', '/icons/']
const CACHE_FIRST_EXACT = ['/manifest.webmanifest']

/** 同一オリジンかを判定する。ワーカーとテストの両方で動くようにする */
function sameOrigin(url: URL): boolean {
  const location =
    typeof self !== 'undefined' && 'location' in self
      ? (self as unknown as { location: { origin: string } }).location
      : undefined
  if (!location) return true
  return url.origin === location.origin
}

/**
 * リクエストごとの扱いを決める。
 *
 * GET 以外には一切介入しない。Server Actions は POST であり、
 * 介入するとアプリの全機能が止まる。
 * 別オリジン（Supabase / Gemini）と /api にも手を出さない。
 */
export function chooseStrategy(input: {
  method: string
  url: string
  mode: string
}): CacheStrategy {
  if (input.method !== 'GET') return 'passthrough'

  let url: URL
  try {
    url = new URL(input.url)
  } catch {
    return 'passthrough'
  }

  if (!sameOrigin(url)) return 'passthrough'
  if (url.pathname.startsWith('/api/')) return 'passthrough'

  if (input.mode === 'navigate') return 'network-first'

  if (CACHE_FIRST_EXACT.includes(url.pathname)) return 'cache-first'
  if (CACHE_FIRST_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return 'cache-first'
  }

  return 'passthrough'
}
