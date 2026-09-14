import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy, buildSecurityHeaders } from '../security-headers'

const NONCE = 'abc123'
const SUPABASE = 'https://example.supabase.co'

function csp(overrides: Partial<Parameters<typeof buildContentSecurityPolicy>[0]> = {}) {
  return buildContentSecurityPolicy({
    nonce: NONCE,
    supabaseOrigin: SUPABASE,
    isDevelopment: false,
    ...overrides,
  })
}

describe('buildContentSecurityPolicy', () => {
  it('既定は自分の配信元だけにする', () => {
    expect(csp()).toContain("default-src 'self'")
  })

  it('スクリプトは nonce の付いたものだけ通す', () => {
    // 外から差し込まれた script を実行させない
    expect(csp()).toContain(`'nonce-${NONCE}'`)
    expect(csp()).toContain("'strict-dynamic'")
  })

  it('本番では eval を許さない', () => {
    expect(csp({ isDevelopment: false })).not.toContain("'unsafe-eval'")
  })

  it('開発では eval を許す', () => {
    // React が詳しい手掛かりを出すために使う
    expect(csp({ isDevelopment: true })).toContain("'unsafe-eval'")
  })

  it('style 属性のために、装飾だけは inline を許す', () => {
    // 画面全体で style 属性を使っており、nonce では許可できない
    expect(csp()).toMatch(/style-src [^;]*'unsafe-inline'/)
  })

  it('スクリプトには inline を許さない', () => {
    // 装飾と違い、ここを緩めると XSS を止められない
    const scriptPart = csp().split(';').find((part) => part.includes('script-src')) ?? ''
    expect(scriptPart).not.toContain("'unsafe-inline'")
  })

  it('通信先に Supabase を含める', () => {
    // 含めないと、ログインもデータの読み書きもできなくなる
    expect(csp()).toContain(SUPABASE)
  })

  it('Supabase の配信元が分からなければ、自分の配信元だけにする', () => {
    const value = csp({ supabaseOrigin: '' })
    expect(value).toContain("connect-src 'self'")
    expect(value).not.toContain('undefined')
  })

  it('常駐処理を自分の配信元から読めるようにする', () => {
    // 塞ぐと PWA のオフライン表示が動かなくなる
    expect(csp()).toContain("worker-src 'self'")
  })

  it('開発では自動更新の通信を通す', () => {
    // 塞ぐと、編集しても画面に反映されない
    expect(csp({ isDevelopment: true })).toContain('ws:')
  })

  it('本番では自動更新の通信を通さない', () => {
    expect(csp({ isDevelopment: false })).not.toContain('ws:')
  })

  it('他のサイトに埋め込ませない', () => {
    expect(csp()).toContain("frame-ancestors 'none'")
  })

  it('差し込みに使われやすいものを塞ぐ', () => {
    expect(csp()).toContain("object-src 'none'")
    expect(csp()).toContain("base-uri 'self'")
    expect(csp()).toContain("form-action 'self'")
  })

  it('1 行にまとめる', () => {
    expect(csp()).not.toContain('\n')
  })
})

describe('buildSecurityHeaders', () => {
  function headers(isProduction: boolean) {
    return new Map(
      buildSecurityHeaders({ nonce: NONCE, supabaseOrigin: SUPABASE, isProduction }),
    )
  }

  it('内容の取り違えを防ぐ', () => {
    expect(headers(true).get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('枠に埋め込ませない', () => {
    expect(headers(true).get('X-Frame-Options')).toBe('DENY')
  })

  it('参照元を漏らしすぎない', () => {
    expect(headers(true).get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('使わない機能を閉じる', () => {
    const value = headers(true).get('Permissions-Policy') ?? ''
    expect(value).toContain('camera=()')
    expect(value).toContain('geolocation=()')
  })

  it('本番では常時暗号化を求める', () => {
    expect(headers(true).get('Strict-Transport-Security')).toContain('max-age=')
  })

  it('開発では常時暗号化を求めない', () => {
    // 手元は http で動かすため、付けると開けなくなる
    expect(headers(false).has('Strict-Transport-Security')).toBe(false)
  })

  it('CSP を含める', () => {
    expect(headers(true).get('Content-Security-Policy')).toContain("default-src 'self'")
  })
})
