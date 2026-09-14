import { NextResponse } from 'next/server'
import {
  EXPECTED_SCHEMA,
  type TableCheck,
  missingColumnsFrom,
  summarizeSchemaChecks,
} from '@/lib/domain/schema-check'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceSupabaseClient } from '@/lib/supabase/service'

/**
 * 設定が届いているかを確かめるための経路。
 *
 * **値は一切返さない。** 有無と、形式が壊れていないかだけを返す。
 * 本番で 500 になったとき、原因が「設定漏れ」か「値の壊れ」か
 * 「別の不具合」かを外から切り分けられるようにするためのもの。
 *
 * proxy を通さない設定にしている。proxy 自体が落ちているときでも
 * 応答できなければ、切り分けの役に立たないため。
 *
 * 表の構造も確かめる。移行 SQL の適用漏れは 2 度起きており、
 * 外から確かめる手段が無いと、毎回やり取りを重ねて切り分けることになる。
 * ここでも**返すのは列の名前と有無だけ**で、データの中身は含めない。
 *
 * **詳細は管理者にだけ返す。**
 * 設定の文字数や表・列の名前は、攻める側の手掛かりになる。
 * ただし「設定が壊れてログインできない」ときの切り分けに使うため、
 * 認証できない場合も**動いているかどうかだけ**は返す。
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

/**
 * 表と列がそろっているかを確かめる。
 *
 * `limit(0)` で問い合わせる。**行は 1 件も返らない**ため、
 * データの中身がこの経路から出ることはない。
 * 列が無ければ問い合わせ自体が失敗し、その理由から不足を拾う。
 */
async function checkSchema(): Promise<{ ok: boolean; missing: string[] } | null> {
  const service = createServiceSupabaseClient()
  // 鍵が無ければ調べられない。「問題なし」とは言わず、未確認として返す
  if (!service) return null

  const checks: TableCheck[] = await Promise.all(
    EXPECTED_SCHEMA.map(async (expected) => {
      const { error } = await service
        .from(expected.table)
        .select(expected.columns.join(', '))
        .limit(0)

      if (!error) return { table: expected.table, ok: true, missing: [] }

      return {
        table: expected.table,
        ok: false,
        missing: missingColumnsFrom(error.message ?? '', expected.columns),
      }
    }),
  )

  return summarizeSchemaChecks(checks)
}

/** この要求が管理者のものか。判定できなければ false */
async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    return Boolean(data?.is_admin)
  } catch {
    // 判定できないときは詳細を出さない
    return false
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

  // 構造の確認そのものが失敗しても、設定の確認は返す。
  // 切り分けの手段を、別の不具合で失いたくない
  let schema: { ok: boolean; missing: string[] } | null = null
  try {
    schema = await checkSchema()
  } catch {
    schema = null
  }

  const ok = canAuthenticate && schema?.ok !== false

  const status = ok ? 200 : 503
  const noStore = { 'Cache-Control': 'no-store' } as const

  // 管理者でなければ、動いているかどうかだけを返す。
  // 設定の文字数や表・列の名前は、攻める側の手掛かりになる
  if (!(await isAdmin())) {
    return NextResponse.json({ ok }, { status, headers: noStore })
  }

  return NextResponse.json(
    {
      ok,
      supabaseUrlParses,
      supabaseUrlProtocol,
      configured,
      // null は「調べられなかった」。問題なしとは区別する
      schema: schema ?? { ok: null, missing: [], note: '構造を確認できませんでした' },
    },
    { status, headers: noStore },
  )
}
