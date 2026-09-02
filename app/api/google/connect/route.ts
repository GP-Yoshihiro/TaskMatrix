import { randomBytes } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { buildAuthUrl } from '@/lib/google/calendar'
import { buildRedirectUri, readGoogleConfig } from '@/lib/google/config'
import { sanitizeReturnPath } from '@/lib/google/return-path'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** state を持たせる cookie。第三者に読ませないよう httpOnly にする */
export const STATE_COOKIE = 'google_oauth_state'

/** 連携後に戻る先を覚えておく cookie */
export const RETURN_COOKIE = 'google_oauth_return'

const STATE_MAX_AGE_SECONDS = 600

/** Google の同意画面へ送る */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const config = readGoogleConfig()
  if (!config) {
    return NextResponse.redirect(new URL('/settings?google=not_configured', request.url))
  }

  // 外部 URL を弾いてから覚える。踏み台にされないため
  const returnPath = sanitizeReturnPath(request.nextUrl.searchParams.get('from'))

  // 偽装された認可コードを踏ませる攻撃（CSRF）を防ぐための使い捨ての値
  const state = randomBytes(32).toString('base64url')

  const response = NextResponse.redirect(
    buildAuthUrl({
      clientId: config.clientId,
      redirectUri: buildRedirectUri(request.nextUrl.origin),
      state,
    }),
  )

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: STATE_MAX_AGE_SECONDS,
  }

  response.cookies.set(STATE_COOKIE, state, cookieOptions)
  response.cookies.set(RETURN_COOKIE, returnPath, cookieOptions)

  return response
}
