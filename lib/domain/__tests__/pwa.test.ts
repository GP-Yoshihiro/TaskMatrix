import { describe, expect, it } from 'vitest'
import { APP_SHELL, chooseStrategy } from '@/lib/domain/pwa'

const origin = 'http://localhost:3000'

function req(url: string, options: { method?: string; mode?: string } = {}) {
  return {
    method: options.method ?? 'GET',
    url: url.startsWith('http') ? url : `${origin}${url}`,
    mode: options.mode ?? 'cors',
  }
}

describe('chooseStrategy', () => {
  it('GET 以外は素通しする', () => {
    // Server Actions は POST。介入すると全機能が壊れる
    expect(chooseStrategy(req('/projects', { method: 'POST' }))).toBe('passthrough')
    expect(chooseStrategy(req('/projects', { method: 'PUT' }))).toBe('passthrough')
    expect(chooseStrategy(req('/projects', { method: 'DELETE' }))).toBe('passthrough')
  })

  it('ページ遷移はネットワーク優先', () => {
    expect(chooseStrategy(req('/dashboard', { mode: 'navigate' }))).toBe('network-first')
  })

  it('ビルド成果物はキャッシュ優先', () => {
    expect(chooseStrategy(req('/_next/static/chunks/main.js'))).toBe('cache-first')
  })

  it('アイコンと manifest はキャッシュ優先', () => {
    expect(chooseStrategy(req('/icons/icon-192.png'))).toBe('cache-first')
    expect(chooseStrategy(req('/manifest.webmanifest'))).toBe('cache-first')
  })

  it('API は素通しする', () => {
    expect(chooseStrategy(req('/api/projects/x/schedule.ics'))).toBe('passthrough')
  })

  it('API へのページ遷移でも素通しする', () => {
    expect(
      chooseStrategy(req('/api/projects/x/schedule.ics', { mode: 'navigate' })),
    ).toBe('passthrough')
  })

  it('別オリジンへの通信は素通しする', () => {
    // Supabase と Gemini に手を出さない
    expect(
      chooseStrategy(req('https://patasstmipeqaaovfihv.supabase.co/rest/v1/tasks')),
    ).toBe('passthrough')
    expect(
      chooseStrategy(req('https://generativelanguage.googleapis.com/v1beta/x')),
    ).toBe('passthrough')
  })

  it('その他の同一オリジンの GET は素通しする', () => {
    expect(chooseStrategy(req('/some/unknown/path.txt'))).toBe('passthrough')
  })

  it('解釈できない URL でも例外を投げない', () => {
    const broken = { method: 'GET', url: 'ではないURL', mode: 'cors' }
    expect(() => chooseStrategy(broken)).not.toThrow()
    expect(chooseStrategy(broken)).toBe('passthrough')
  })
})

describe('APP_SHELL', () => {
  it('オフラインページを含む', () => {
    expect([...APP_SHELL]).toContain('/offline')
  })

  it('manifest とアイコンを含む', () => {
    expect([...APP_SHELL]).toContain('/manifest.webmanifest')
    expect(APP_SHELL.some((path) => path.startsWith('/icons/'))).toBe(true)
  })

  it('利用者のデータを含む経路が入っていない', () => {
    // 古いデータを見せないため、データを含む画面はキャッシュしない
    for (const path of APP_SHELL) {
      expect(path.startsWith('/projects')).toBe(false)
      expect(path.startsWith('/dashboard')).toBe(false)
      expect(path.startsWith('/api')).toBe(false)
      expect(path.startsWith('/settings')).toBe(false)
    }
  })
})
