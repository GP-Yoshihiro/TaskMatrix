import { NextResponse, type NextRequest } from 'next/server'
import { decideProtectedRouteAction, isConnectivityFailure } from '@/lib/domain/auth'
import { buildSecurityHeaders } from '@/lib/domain/security-headers'

/** 保護対象のパス接頭辞 */
const PROTECTED_PREFIXES = ['/dashboard', '/projects', '/settings']

/**
 * セッションを更新し、未認証なら保護ルートからログイン画面へ退避させる。
 *
 * **どんな理由であれ、ここで例外を外に出さない。**
 * proxy はほぼ全ての要求を通るため、投げると静的ファイルまで 500 になり、
 * 何が起きているのかを確かめる手段まで失われる。
 */
export async function updateSession(request: NextRequest) {
  /*
   * 要求ごとに使い捨ての印を作る。
   *
   * これが付いた script だけを実行させる。推測できると意味が無いので、
   * 毎回作り直す。
   */
  const nonce = crypto.randomUUID().replace(/-/g, '')

  try {
    const response = await handle(request, nonce)
    applySecurityHeaders(response, request, nonce)
    return response
  } catch {
    // セッションの更新だけを諦めて通す。原因は /api/health で確かめられる
    const fallback = NextResponse.next({ request })
    applySecurityHeaders(fallback, request, nonce)
    return fallback
  }
}

/**
 * 防御用のヘッダーを付ける。
 *
 * **すべての応答に付ける。** 保護対象かどうかに関わらず、
 * 埋め込みや差し込みは起こりうる。
 */
function applySecurityHeaders(
  response: NextResponse,
  request: NextRequest,
  nonce: string,
): void {
  let supabaseOrigin = ''
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (raw) supabaseOrigin = new URL(raw).origin
  } catch {
    // 解析できなければ通信先を足さない。足りなければ画面が動かないので気付ける
  }

  const headers = buildSecurityHeaders({
    nonce,
    supabaseOrigin,
    isProduction: process.env.NODE_ENV === 'production',
  })

  for (const [name, value] of headers) response.headers.set(name, value)
}

async function handle(request: NextRequest, nonce: string) {
  // 画面側が印を読めるようにする。Next はこれを script に付ける
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  /*
   * 設定が欠けているときは、ここで例外を投げない。
   *
   * 投げると proxy を通る全経路（静的ファイルも含む）が 500 になり、
   * 「何が起きているのか」を確かめる手段まで失われる。
   * セッションの更新だけを諦めて通し、原因は /api/health で確かめられるようにする。
   */
  if (!url || !anonKey) return response

  /*
   * 保護対象でなければ、認証の問い合わせをしない。
   *
   * getUser() は毎回 Supabase へ往復する。ログイン画面・使い方・
   * プライバシーポリシー・画像などでは、その答えを使う場面が無い。
   * 通る経路のすべてで往復していては、体感が落ちるだけである。
   */
  if (!PROTECTED_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix))) {
    return response
  }

  /*
   * 読み込みを関数の中で行う。
   *
   * 先頭で読み込むと、その読み込み自体が失敗したときに
   * 下の try/catch では捕まえられず、proxy を通る全経路が 500 になる。
   */
  const { createServerClient } = await import('@supabase/ssr')

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request: { headers: requestHeaders } })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // 認証サービスに到達できない場合と、認証されていない場合を区別する。
  // 混同すると、通信が不安定なだけの利用者をログアウト扱いにしてしまう。
  let hasUser = false
  let connectivityFailed = false

  try {
    const { data, error } = await supabase.auth.getUser()
    hasUser = data.user !== null
    connectivityFailed = isConnectivityFailure(error)
  } catch (error) {
    connectivityFailed = isConnectivityFailure(
      error as { message?: string; name?: string; status?: number },
    )
  }

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix))

  const action = decideProtectedRouteAction({ hasUser, connectivityFailed, isProtected })

  if (action === 'login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (action === 'offline') {
    const url = request.nextUrl.clone()
    url.pathname = '/offline'
    return NextResponse.redirect(url)
  }

  return response
}
