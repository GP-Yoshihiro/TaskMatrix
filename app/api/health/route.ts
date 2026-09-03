import { NextResponse } from 'next/server'

/**
 * 設定が届いているかを確かめるための経路。
 *
 * **値は一切返さない。** 「その名前の変数が入っているか」だけを真偽で返す。
 * 本番で 500 になったとき、原因が「設定漏れ」か「別の不具合」かを
 * 外から切り分けられるようにするためのもの。
 *
 * proxy を通さない設定にしている。proxy 自体が落ちているときでも
 * 応答できなければ、切り分けの役に立たないため。
 */
export async function GET() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_TOKEN_ENCRYPTION_KEY',
  ] as const

  const configured: Record<string, boolean> = {}
  for (const name of required) {
    configured[name] = Boolean(process.env[name])
  }

  // 画面を出すのに最低限必要な 2 つが揃っているか
  const canAuthenticate =
    configured.NEXT_PUBLIC_SUPABASE_URL && configured.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return NextResponse.json(
    { ok: canAuthenticate, configured },
    { status: canAuthenticate ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
