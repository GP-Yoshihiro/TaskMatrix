/**
 * 連携後に戻る先。
 *
 * 外部の URL を受け付けると、このアプリを踏み台に任意のサイトへ
 * 転送できてしまう（オープンリダイレクト）。
 * 自サイト内の絶対パスだけを通す。
 */
const DEFAULT_RETURN_PATH = '/settings'

/**
 * 制御文字とバックスラッシュ。
 * 改行はヘッダー分割の、バックスラッシュは外部サイト解釈の足がかりになる。
 */
const FORBIDDEN = /[\u0000-\u001f\u007f\\]/

export function sanitizeReturnPath(value: string | null): string {
  if (!value) return DEFAULT_RETURN_PATH

  // "/" で始まり、"//" で始まらないものだけを通す。
  // "//example.com" はブラウザが外部サイトとして解釈するため弾く
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_RETURN_PATH

  if (FORBIDDEN.test(value)) return DEFAULT_RETURN_PATH

  return value
}

export function buildReturnUrl(path: string, result: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}google=${encodeURIComponent(result)}`
}
