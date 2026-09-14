/**
 * 防御用の HTTP ヘッダー。
 *
 * このアプリには生の HTML を差し込む箇所が無く（`dangerouslySetInnerHTML` は 0 件、
 * Markdown も HTML を無効にしたまま描いている）、XSS の主経路は塞がっている。
 * ここで付けるのは**それが破れたときに食い止める層**であり、
 * 埋め込み・差し込み・意図しない送信先への通信を防ぐ。
 */

/** 常時暗号化を求める期間。2 年 */
const HSTS_MAX_AGE = 63_072_000

/**
 * 内容の取り扱い方針。
 *
 * スクリプトは**nonce の付いたものだけ**通す。
 * 一方で装飾は `unsafe-inline` を許す。画面全体で `style` 属性を使っており、
 * 属性は nonce では許可できないため。
 * 装飾を緩めても、スクリプトを止めていれば差し込みは実行されない。
 */
export function buildContentSecurityPolicy(input: {
  nonce: string
  /** ブラウザから直接つなぐ Supabase の配信元。空なら自分の配信元だけにする */
  supabaseOrigin: string
  isDevelopment: boolean
}): string {
  // 開発では React が手掛かりを出すために eval を使う。本番では使わない
  const evalPart = input.isDevelopment ? " 'unsafe-eval'" : ''

  const origins = [input.supabaseOrigin]
  // 開発時の自動更新は WebSocket で行う。塞ぐと編集が画面に反映されない
  if (input.isDevelopment) origins.push('ws:')

  const connect = origins.filter(Boolean).join(' ')

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${input.nonce}' 'strict-dynamic'${evalPart}`,
    // style 属性のために必要。nonce では属性を許可できない
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self'${connect ? ` ${connect}` : ''}`,
    // PWA の常駐処理。塞ぐとオフライン表示が動かない
    "worker-src 'self'",
    // 差し込みに使われやすいものを塞ぐ
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // 他のサイトに埋め込ませない（クリックの誘導を防ぐ）
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/** 付けるヘッダーの一覧。名前と値の組で返す */
export function buildSecurityHeaders(input: {
  nonce: string
  supabaseOrigin: string
  isProduction: boolean
}): [string, string][] {
  const headers: [string, string][] = [
    [
      'Content-Security-Policy',
      buildContentSecurityPolicy({
        nonce: input.nonce,
        supabaseOrigin: input.supabaseOrigin,
        isDevelopment: !input.isProduction,
      }),
    ],
    // 内容の種類を勝手に推測させない
    ['X-Content-Type-Options', 'nosniff'],
    // 古い browser 向け。frame-ancestors と同じ意図
    ['X-Frame-Options', 'DENY'],
    // 外部へ渡す参照元を配信元までに留める
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    // 使わない機能は閉じておく
    [
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    ],
  ]

  // 手元は http で動かすため、本番だけに付ける
  if (input.isProduction) {
    headers.push([
      'Strict-Transport-Security',
      `max-age=${HSTS_MAX_AGE}; includeSubDomains; preload`,
    ])
  }

  return headers
}
