import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

/**
 * public/sw.js の fetch ハンドラを実際に動かして、
 * オフライン時にオフラインページを返すことを確かめる。
 *
 * 判定（chooseStrategy）が正しくても、ハンドラの組み立てを誤れば
 * 意図した応答は返らない。そこを実行して確かめる。
 */

const ORIGIN = 'http://localhost:3000'

type Handlers = Record<string, (event: unknown) => void>

function loadServiceWorker(options: {
  /** ネットワークの応答。null なら失敗（オフライン）を意味する */
  networkResponse: { body: string; ok: boolean } | null
  /** キャッシュの中身。パス → 本文 */
  cached: Record<string, string>
}) {
  const source = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8')
  const handlers: Handlers = {}

  class FakeResponse {
    body: string
    status: number
    ok: boolean
    constructor(body: string, init?: { status?: number }) {
      this.body = body
      this.status = init?.status ?? 200
      this.ok = this.status < 400
    }
    clone() {
      return new FakeResponse(this.body, { status: this.status })
    }
    text() {
      return Promise.resolve(this.body)
    }
  }

  const put: { key: string; body: string }[] = []

  const cacheStore = {
    /**
     * Next.js の応答は Vary に Accept-Encoding を含むため、
     * 既定の照合では取り出せない。実際の挙動を再現するため、
     * ignoreVary が渡されない限り undefined を返す。
     */
    match: (
      request: string | { url: string },
      matchOptions?: { ignoreVary?: boolean },
    ) => {
      if (!matchOptions?.ignoreVary) return Promise.resolve(undefined)
      const key = typeof request === 'string' ? request : new URL(request.url).pathname
      const body = options.cached[key]
      return Promise.resolve(body === undefined ? undefined : new FakeResponse(body))
    },
    add: () => Promise.resolve(),
    put: (request: string | { url: string }, response: FakeResponse) => {
      const key = typeof request === 'string' ? request : new URL(request.url).pathname
      put.push({ key, body: response.body })
      return Promise.resolve()
    },
    keys: () => Promise.resolve([]),
  }

  const sandbox = {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        handlers[type] = handler
      },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
    },
    caches: {
      open: () => Promise.resolve(cacheStore),
      match: cacheStore.match,
      keys: () => Promise.resolve([]),
      delete: () => Promise.resolve(true),
    },
    fetch: () =>
      options.networkResponse === null
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve(
            new FakeResponse(options.networkResponse.body, {
              status: options.networkResponse.ok ? 200 : 500,
            }),
          ),
    URL,
    Response: FakeResponse,
    Promise,
    console,
  }

  const context = createContext(sandbox)
  runInContext(source, context)

  return { handlers, put }
}

/** fetch イベントを模して、ハンドラが返した応答を取り出す */
async function runFetch(
  handlers: Handlers,
  request: { method: string; url: string; mode: string },
): Promise<{ responded: boolean; body: string | null }> {
  let responded = false
  let promise: Promise<{ text(): Promise<string> }> | null = null

  handlers.fetch({
    request,
    respondWith: (value: Promise<{ text(): Promise<string> }>) => {
      responded = true
      promise = value
    },
  })

  if (!responded || !promise) return { responded: false, body: null }

  const response = await promise
  return { responded: true, body: await response.text() }
}

describe('sw.js の fetch ハンドラ', () => {
  it('オンラインのページ遷移はネットワークの応答を返す', async () => {
    const { handlers } = loadServiceWorker({
      networkResponse: { body: 'ダッシュボードの中身', ok: true },
      cached: { '/offline': 'オフラインです' },
    })

    const result = await runFetch(handlers, {
      method: 'GET',
      url: `${ORIGIN}/dashboard`,
      mode: 'navigate',
    })

    expect(result.responded).toBe(true)
    expect(result.body).toBe('ダッシュボードの中身')
  })

  it('オフラインのページ遷移はオフラインページを返す', async () => {
    const { handlers } = loadServiceWorker({
      networkResponse: null,
      cached: { '/offline': 'オフラインです' },
    })

    const result = await runFetch(handlers, {
      method: 'GET',
      url: `${ORIGIN}/dashboard`,
      mode: 'navigate',
    })

    expect(result.responded).toBe(true)
    expect(result.body).toBe('オフラインです')
  })

  it('保護されたページでもオフラインならオフラインページを返す', async () => {
    // ログイン画面ではなくオフライン画面が出なければならない
    const { handlers } = loadServiceWorker({
      networkResponse: null,
      cached: { '/offline': 'オフラインです' },
    })

    for (const path of ['/projects', '/projects/abc/tasks', '/settings', '/']) {
      const result = await runFetch(handlers, {
        method: 'GET',
        url: `${ORIGIN}${path}`,
        mode: 'navigate',
      })
      expect(result.body).toBe('オフラインです')
    }
  })

  it('オフラインでキャッシュも無ければ日本語の案内を返す', async () => {
    const { handlers } = loadServiceWorker({ networkResponse: null, cached: {} })

    const result = await runFetch(handlers, {
      method: 'GET',
      url: `${ORIGIN}/dashboard`,
      mode: 'navigate',
    })

    expect(result.responded).toBe(true)
    expect(result.body).toContain('オフライン')
  })

  it('POST には応答しない（ブラウザに任せる）', async () => {
    const { handlers } = loadServiceWorker({
      networkResponse: { body: 'x', ok: true },
      cached: {},
    })

    const result = await runFetch(handlers, {
      method: 'POST',
      url: `${ORIGIN}/projects`,
      mode: 'cors',
    })

    expect(result.responded).toBe(false)
  })

  it('別オリジンには応答しない', async () => {
    const { handlers } = loadServiceWorker({
      networkResponse: { body: 'x', ok: true },
      cached: {},
    })

    const result = await runFetch(handlers, {
      method: 'GET',
      url: 'https://patasstmipeqaaovfihv.supabase.co/rest/v1/tasks',
      mode: 'cors',
    })

    expect(result.responded).toBe(false)
  })

  it('キャッシュ優先の資源はキャッシュから返す', async () => {
    const { handlers } = loadServiceWorker({
      networkResponse: { body: 'ネットワークの中身', ok: true },
      cached: { '/icons/icon-192.png': 'キャッシュの中身' },
    })

    const result = await runFetch(handlers, {
      method: 'GET',
      url: `${ORIGIN}/icons/icon-192.png`,
      mode: 'cors',
    })

    expect(result.body).toBe('キャッシュの中身')
  })
})

describe('Vary ヘッダへの対処', () => {
  it('caches.match に ignoreVary を渡している', () => {
    // 渡していなければ、上のモックが undefined を返すため
    // 「オフラインです」ではなく代替の応答になる
    const source = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8')
    const matchCalls = source.match(/caches\.match\([^)]*\)/g) ?? []
    expect(matchCalls.length).toBeGreaterThan(0)
    for (const call of matchCalls) {
      expect(call).toContain('ignoreVary')
    }
  })
})
