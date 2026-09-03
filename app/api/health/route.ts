import { NextResponse } from 'next/server'

/**
 * 設定が届いているかを確かめるための経路。
 *
 * **値は一切返さない。** 有無と、形式が壊れていないかだけを返す。
 * 本番で 500 になったとき、原因が「設定漏れ」か「値の壊れ」か
 * 「別の不具合」かを外から切り分けられるようにするためのもの。
 *
 * proxy を通さない設定にしている。proxy 自体が落ちているときでも
 * 応答できなければ、切り分けの役に立たないため。
 */

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_TOKEN_ENCRYPTION_KEY',
] as const

/**
 * 値の形が壊れていないかを調べる。
 *
 * 設定画面へ貼り付けるときに、引用符や改行、前後の空白が
 * 紛れ込むことがある。「値はあるのに使えない」状態になり、
 * 有無だけを見ていると見逃す。
 */
function inspect(value: string | undefined) {
  if (!value) return { present: false }

  return {
    present: true,
    // 引用符ごと貼り付けてしまった場合
    wrappedInQuotes: /^["'].*["']$/.test(value),
    // 改行や前後の空白が混ざった場合
    hasSurroundingWhitespace: value !== value.trim(),
    hasNewline: /[\r\n]/.test(value),
    length: value.length,
  }
}

export async function GET() {
  const configured: Record<string, ReturnType<typeof inspect>> = {}
  for (const name of REQUIRED) {
    configured[name] = inspect(process.env[name])
  }

  // Supabase の URL は解析できなければ接続そのものが作れない
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  let supabaseUrlParses = false
  let supabaseUrlProtocol: string | null = null

  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl)
      supabaseUrlParses = true
      supabaseUrlProtocol = parsed.protocol
    } catch {
      supabaseUrlParses = false
    }
  }

  const canAuthenticate =
    configured.NEXT_PUBLIC_SUPABASE_URL.present &&
    configured.NEXT_PUBLIC_SUPABASE_ANON_KEY.present &&
    supabaseUrlParses

  return NextResponse.json(
    { ok: canAuthenticate, supabaseUrlParses, supabaseUrlProtocol, configured },
    { status: canAuthenticate ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
