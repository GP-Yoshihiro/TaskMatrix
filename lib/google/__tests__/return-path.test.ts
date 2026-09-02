import { describe, expect, it } from 'vitest'
import { buildReturnUrl, sanitizeReturnPath } from '../return-path'

describe('sanitizeReturnPath', () => {
  it('自サイト内のパスはそのまま通す', () => {
    expect(sanitizeReturnPath('/projects/abc/schedule')).toBe('/projects/abc/schedule')
  })

  it('問い合わせ付きのパスも通す', () => {
    expect(sanitizeReturnPath('/a?b=c')).toBe('/a?b=c')
  })

  it('未指定なら設定画面に戻す', () => {
    expect(sanitizeReturnPath(null)).toBe('/settings')
    expect(sanitizeReturnPath('')).toBe('/settings')
  })

  it('外部の URL は受け付けない', () => {
    // このアプリを踏み台にして任意のサイトへ転送させないため
    expect(sanitizeReturnPath('https://example.com/steal')).toBe('/settings')
    expect(sanitizeReturnPath('http://example.com')).toBe('/settings')
  })

  it('// で始まる指定も外部として弾く', () => {
    // "//example.com" はブラウザが外部サイトとして解釈する
    expect(sanitizeReturnPath('//example.com/steal')).toBe('/settings')
  })

  it('バックスラッシュを含む指定を弾く', () => {
    expect(sanitizeReturnPath('/\\example.com')).toBe('/settings')
  })

  it('改行を含む指定を弾く', () => {
    expect(sanitizeReturnPath('/ok\nLocation: https://example.com')).toBe('/settings')
  })

  it('相対パスは受け付けない', () => {
    expect(sanitizeReturnPath('projects/abc')).toBe('/settings')
  })
})

describe('buildReturnUrl', () => {
  it('結果を付けて戻り先を組み立てる', () => {
    expect(buildReturnUrl('/settings', 'connected')).toBe('/settings?google=connected')
  })

  it('すでに問い合わせがあれば & でつなぐ', () => {
    expect(buildReturnUrl('/a?b=c', 'failed')).toBe('/a?b=c&google=failed')
  })
})
