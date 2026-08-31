/**
 * TaskMatrix の Service Worker。
 *
 * ⚠️ 重要: 判定ロジックは lib/domain/pwa.ts と同じ内容を写している。
 * Service Worker は import できないため写しにせざるを得ない。
 * **どちらかを変えたら必ず両方を直すこと。**
 * ずれるとテストが実態を保証しなくなる。
 *
 * 注意: caches.match には必ず { ignoreVary: true } を渡すこと。
 * Next.js の応答は Vary に Accept-Encoding を含むため、
 * 既定の照合では保存したものを取り出せず、キャッシュに入っているのに
 * 取り出せないという分かりにくい不具合になる。
 *
 * 守るべき一線:
 * - GET 以外には一切介入しない（Server Actions は POST）
 * - 別オリジン（Supabase / Gemini）に触れない
 * - /api に触れない
 * - 利用者のデータをキャッシュしない
 */

const CACHE_NAME = 'taskmatrix-shell-v2'

const APP_SHELL = [
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

const CACHE_FIRST_PREFIXES = ['/_next/static/', '/icons/']
const CACHE_FIRST_EXACT = ['/manifest.webmanifest']

function chooseStrategy(request) {
  if (request.method !== 'GET') return 'passthrough'

  let url
  try {
    url = new URL(request.url)
  } catch {
    return 'passthrough'
  }

  if (url.origin !== self.location.origin) return 'passthrough'
  if (url.pathname.startsWith('/api/')) return 'passthrough'
  if (request.mode === 'navigate') return 'network-first'
  if (CACHE_FIRST_EXACT.includes(url.pathname)) return 'cache-first'
  if (CACHE_FIRST_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return 'cache-first'
  }

  return 'passthrough'
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // 1 つ失敗しても全体を止めない
      .then((cache) => Promise.allSettled(APP_SHELL.map((path) => cache.add(path))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const strategy = chooseStrategy(event.request)
  if (strategy === 'passthrough') return

  if (strategy === 'network-first') {
    event.respondWith(
      fetch(event.request).catch(() =>
        // ignoreVary が必須。Next.js の応答は Vary に Accept-Encoding を含み、
        // 既定の照合では保存したものを取り出せない
        caches.match('/offline', { ignoreVary: true }).then(
          (cached) =>
            cached ??
            new Response('オフラインです。インターネット接続をご確認ください。', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            }),
        ),
      ),
    )
    return
  }

  event.respondWith(
    caches.match(event.request, { ignoreVary: true }).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
    }),
  )
})
