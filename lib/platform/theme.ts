/** 適用するデザイントークンの系統 */
export type PlatformTheme = 'apple' | 'windows'

/** ユーザーの設定値。auto は User-Agent による自動判定を意味する */
export type ThemePreference = 'auto' | PlatformTheme

/** 解決済みテーマを保存する Cookie 名 */
export const THEME_COOKIE_NAME = 'tm-theme'

const APPLE_PATTERN = /(Macintosh|Mac OS X|iPhone|iPad|iPod)/i

export function detectPlatformFromUserAgent(userAgent: string): PlatformTheme {
  return APPLE_PATTERN.test(userAgent) ? 'apple' : 'windows'
}

export function resolveTheme(
  preference: ThemePreference,
  userAgent: string,
): PlatformTheme {
  if (preference === 'auto') {
    return detectPlatformFromUserAgent(userAgent)
  }
  return preference
}
