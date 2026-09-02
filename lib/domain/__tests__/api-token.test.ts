import { describe, expect, it } from 'vitest'
import {
  RATE_LIMIT_PER_MINUTE,
  RATE_WINDOW_MS,
  TOKEN_PREFIX,
  buildToken,
  displayPrefix,
  hashToken,
  nextRateState,
  parseBearer,
} from '../api-token'

const bytes = (fill: number) => new Uint8Array(32).fill(fill)

describe('buildToken', () => {
  it('接頭辞から始まる', () => {
    expect(buildToken(bytes(1)).startsWith(TOKEN_PREFIX)).toBe(true)
  })

  it('URL に貼れる文字だけで構成する', () => {
    // ショートカットやヘッダーへそのまま貼れる必要がある
    expect(buildToken(bytes(200))).toMatch(/^tmx_[A-Za-z0-9_-]+$/)
  })

  it('元の値が違えば違うトークンになる', () => {
    expect(buildToken(bytes(1))).not.toBe(buildToken(bytes(2)))
  })
})

describe('hashToken', () => {
  it('同じトークンからは同じハッシュが出る', () => {
    expect(hashToken('tmx_abc')).toBe(hashToken('tmx_abc'))
  })

  it('違うトークンからは違うハッシュが出る', () => {
    expect(hashToken('tmx_abc')).not.toBe(hashToken('tmx_abd'))
  })

  it('ハッシュに平文が含まれない', () => {
    // 保存されたハッシュから元のトークンを読み取れてはならない
    const token = buildToken(bytes(7))
    const hash = hashToken(token)

    expect(hash).not.toContain(token)
    expect(hash).not.toContain(token.slice(TOKEN_PREFIX.length))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('displayPrefix', () => {
  it('先頭だけを見せ、全文は見せない', () => {
    const token = buildToken(bytes(3))
    const shown = displayPrefix(token)

    expect(token.startsWith(shown.replace('…', ''))).toBe(true)
    expect(shown.length).toBeLessThan(token.length)
    expect(shown.endsWith('…')).toBe(true)
  })
})

describe('parseBearer', () => {
  it('Bearer 形式からトークンを取り出す', () => {
    expect(parseBearer('Bearer tmx_abc')).toBe('tmx_abc')
  })

  it('ヘッダーが無ければ null', () => {
    expect(parseBearer(null)).toBeNull()
  })

  it('Bearer 以外の方式は受け付けない', () => {
    expect(parseBearer('Basic tmx_abc')).toBeNull()
    expect(parseBearer('tmx_abc')).toBeNull()
  })

  it('中身が空なら null', () => {
    expect(parseBearer('Bearer ')).toBeNull()
    expect(parseBearer('Bearer    ')).toBeNull()
  })

  it('大文字小文字の違いを許す', () => {
    expect(parseBearer('bearer tmx_abc')).toBe('tmx_abc')
  })
})

describe('nextRateState', () => {
  const now = new Date('2026-09-01T10:00:30Z')

  it('初回は窓を開いて 1 回目として通す', () => {
    const state = nextRateState({ windowStartedAt: null, count: 0 }, now)

    expect(state.allowed).toBe(true)
    expect(state.count).toBe(1)
    expect(state.windowStartedAt).toBe(now.toISOString())
  })

  it('窓の中なら数を増やして通す', () => {
    const state = nextRateState(
      { windowStartedAt: '2026-09-01T10:00:00Z', count: 5 },
      now,
    )

    expect(state.allowed).toBe(true)
    expect(state.count).toBe(6)
    expect(state.windowStartedAt).toBe('2026-09-01T10:00:00Z')
  })

  it('上限に達したら止める', () => {
    const state = nextRateState(
      { windowStartedAt: '2026-09-01T10:00:00Z', count: RATE_LIMIT_PER_MINUTE },
      now,
    )

    expect(state.allowed).toBe(false)
    expect(state.count).toBe(RATE_LIMIT_PER_MINUTE)
  })

  it('窓が切れたら数え直す', () => {
    const state = nextRateState(
      {
        windowStartedAt: new Date(now.getTime() - RATE_WINDOW_MS - 1).toISOString(),
        count: RATE_LIMIT_PER_MINUTE,
      },
      now,
    )

    expect(state.allowed).toBe(true)
    expect(state.count).toBe(1)
    expect(state.windowStartedAt).toBe(now.toISOString())
  })

  it('止めたときは窓の残り秒を返す', () => {
    const state = nextRateState(
      { windowStartedAt: '2026-09-01T10:00:00Z', count: RATE_LIMIT_PER_MINUTE },
      now,
    )

    // 10:00:00 に開いた窓は 10:01:00 まで。10:00:30 の時点で残り 30 秒
    expect(state.retryAfterSeconds).toBe(30)
  })

  it('通したときの残り秒は 0', () => {
    expect(nextRateState({ windowStartedAt: null, count: 0 }, now).retryAfterSeconds).toBe(0)
  })
})
