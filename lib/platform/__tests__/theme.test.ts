import { describe, expect, it } from 'vitest'
import { detectPlatformFromUserAgent, resolveTheme } from '@/lib/platform/theme'

const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

describe('detectPlatformFromUserAgent', () => {
  it('macOS を apple と判定する', () => {
    expect(detectPlatformFromUserAgent(MAC_UA)).toBe('apple')
  })

  it('iPhone を apple と判定する', () => {
    expect(detectPlatformFromUserAgent(IPHONE_UA)).toBe('apple')
  })

  it('iPad を apple と判定する', () => {
    expect(detectPlatformFromUserAgent(IPAD_UA)).toBe('apple')
  })

  it('Windows を windows と判定する', () => {
    expect(detectPlatformFromUserAgent(WINDOWS_UA)).toBe('windows')
  })

  it('Apple 以外は windows として扱う', () => {
    expect(detectPlatformFromUserAgent(ANDROID_UA)).toBe('windows')
  })

  it('空の UA でも例外を投げず windows を返す', () => {
    expect(detectPlatformFromUserAgent('')).toBe('windows')
  })
})

describe('resolveTheme', () => {
  it('明示指定は UA より優先される', () => {
    expect(resolveTheme('windows', MAC_UA)).toBe('windows')
    expect(resolveTheme('apple', WINDOWS_UA)).toBe('apple')
  })

  it('auto のときは UA から判定する', () => {
    expect(resolveTheme('auto', MAC_UA)).toBe('apple')
    expect(resolveTheme('auto', WINDOWS_UA)).toBe('windows')
  })
})
