import { type NextRequest, NextResponse } from 'next/server'
import { encryptSecret } from '@/lib/domain/crypto'
import { createCalendar, exchangeCode } from '@/lib/google/calendar'
import { buildRedirectUri, readGoogleConfig } from '@/lib/google/config'
import { buildReturnUrl, sanitizeReturnPath } from '@/lib/google/return-path'
import { createSupabaseGoogleConnectionRepository } from '@/lib/repositories/google-connections'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { RETURN_COOKIE, STATE_COOKIE } from '../connect/route'

/** 結果は元の画面へ戻して伝える。API の応答をそのまま見せない */
function back(request: NextRequest, result: string): NextResponse {
  // cookie の値も外部 URL でないことを確かめてから使う
  const returnPath = sanitizeReturnPath(request.cookies.get(RETURN_COOKIE)?.value ?? null)

  const response = NextResponse.redirect(
    new URL(buildReturnUrl(returnPath, result), request.url),
  )

  // 使い捨ての値なので必ず消す
  response.cookies.delete(STATE_COOKIE)
  response.cookies.delete(RETURN_COOKIE)

  return response
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  // 利用者が同意画面で拒否した場合
  if (request.nextUrl.searchParams.get('error')) return back(request, 'denied')

  const code = request.nextUrl.searchParams.get('code') ?? ''
  const state = request.nextUrl.searchParams.get('state') ?? ''
  const expected = request.cookies.get(STATE_COOKIE)?.value ?? ''

  // state を検証しないと、第三者が用意した認可コードを踏ませて
  // 別アカウントのカレンダーへ接続させられてしまう
  if (!code || !state || !expected || state !== expected) {
    return back(request, 'invalid_state')
  }

  const config = readGoogleConfig()
  if (!config) return back(request, 'not_configured')

  const exchanged = await exchangeCode({
    code,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: buildRedirectUri(request.nextUrl.origin),
  })
  if (!exchanged.ok) {
    console.error('[google] コード交換に失敗:', exchanged.detail ?? exchanged.failure)
    return back(request, 'failed')
  }

  // このアプリ専用のカレンダーを作る。既存のカレンダーには触れない
  const calendar = await createCalendar(exchanged.data.accessToken)
  if (!calendar.ok) {
    console.error('[google] カレンダー作成に失敗:', calendar.detail ?? calendar.failure)
    return back(request, 'failed')
  }

  try {
    await createSupabaseGoogleConnectionRepository(supabase).save({
      userId: user.id,
      // 平文のまま保存しない
      refreshTokenEncrypted: encryptSecret(
        exchanged.data.refreshToken,
        config.encryptionKey,
      ),
      calendarId: calendar.data,
    })
  } catch (error) {
    console.error('[google] 接続の保存に失敗:', (error as Error)?.message)
    return back(request, 'failed')
  }

  return back(request, 'connected')
}
