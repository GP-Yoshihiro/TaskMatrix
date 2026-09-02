import { withTimeout } from '@/lib/gemini/with-timeout'

/**
 * Google Calendar API の最小限の呼び出し。
 *
 * 要求するスコープは calendar.app.created のみ。
 * このアプリが作ったカレンダーしか読み書きできず、
 * 利用者の既存の予定には触れられない。
 */

/** このアプリが作ったカレンダーだけを対象にする、最も狭い権限 */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'

const OAUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

const REQUEST_TIMEOUT_MS = 30_000

/** 専用カレンダーの名前。利用者が Google 側で見分けられるようにする */
export const CALENDAR_NAME = 'TaskMatrix'

export type GoogleFailure =
  /** リフレッシュトークンが失効した。再接続が必要 */
  | 'reconnect_required'
  /** 差分同期の印が古い。全件を取り直す */
  | 'sync_token_expired'
  | 'request_failed'

export type GoogleResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: GoogleFailure; detail?: string }

/**
 * detail には Google が返したエラーの説明だけを入れる。
 * トークン・認可コード・秘密情報は決して入れない。
 */
const fail = (failure: GoogleFailure, detail?: string): GoogleResult<never> => ({
  ok: false,
  failure,
  detail,
})

export function buildAuthUrl(input: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: CALENDAR_SCOPE,
    // リフレッシュトークンを得るために必要
    access_type: 'offline',
    // 再接続でもリフレッシュトークンを確実に受け取る
    prompt: 'consent',
    state: input.state,
  })

  return `${OAUTH_ENDPOINT}?${params.toString()}`
}

async function postForm(body: URLSearchParams): Promise<GoogleResult<Record<string, unknown>>> {
  try {
    const response = await withTimeout(
      fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }),
      REQUEST_TIMEOUT_MS,
    )

    const json = (await response.json()) as Record<string, unknown>

    if (!response.ok) {
      const detail = `token ${response.status}: ${String(json.error ?? '')} ${String(
        json.error_description ?? '',
      )}`.trim()

      // 失効は再接続を促す必要があるため区別する
      return fail(
        json.error === 'invalid_grant' ? 'reconnect_required' : 'request_failed',
        detail,
      )
    }

    return { ok: true, data: json }
  } catch (error) {
    return fail('request_failed', `token fetch: ${(error as Error)?.message ?? 'unknown'}`)
  }
}

export async function exchangeCode(input: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<GoogleResult<{ accessToken: string; refreshToken: string }>> {
  const result = await postForm(
    new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    }),
  )
  if (!result.ok) return result

  const accessToken = String(result.data.access_token ?? '')
  const refreshToken = String(result.data.refresh_token ?? '')

  // リフレッシュトークンが無いと次回以降つながらない
  if (!accessToken || !refreshToken) {
    // access_type=offline と prompt=consent を付けても返らないことがある
    return fail(
      'request_failed',
      `exchange missing token (access:${Boolean(accessToken)} refresh:${Boolean(refreshToken)})`,
    )
  }

  return { ok: true, data: { accessToken, refreshToken } }
}

export async function refreshAccessToken(input: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<GoogleResult<string>> {
  const result = await postForm(
    new URLSearchParams({
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: 'refresh_token',
    }),
  )
  if (!result.ok) return result

  const accessToken = String(result.data.access_token ?? '')
  if (!accessToken) return fail('request_failed')

  return { ok: true, data: accessToken }
}

async function callApi(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<GoogleResult<Record<string, unknown>>> {
  try {
    const response = await withTimeout(
      fetch(`${CALENDAR_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      }),
      REQUEST_TIMEOUT_MS,
    )

    // 削除は本文を返さない
    if (response.status === 204) return { ok: true, data: {} }

    // 差分同期の印が古くなった
    if (response.status === 410) return fail('sync_token_expired')

    if (response.status === 401) return fail('reconnect_required', 'api 401')

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string; errors?: { reason?: string }[] }
      }
      const reason = body.error?.errors?.[0]?.reason ?? ''
      const detail = `api ${response.status} ${path.split('?')[0]}: ${reason} ${
        body.error?.message ?? ''
      }`.trim()

      return fail('request_failed', detail)
    }

    return { ok: true, data: (await response.json()) as Record<string, unknown> }
  } catch (error) {
    return fail('request_failed', `api fetch: ${(error as Error)?.message ?? 'unknown'}`)
  }
}

/** 専用カレンダーを作る。既存のカレンダーには一切触れない */
export async function createCalendar(
  accessToken: string,
): Promise<GoogleResult<string>> {
  const result = await callApi(accessToken, '/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: CALENDAR_NAME, timeZone: 'Asia/Tokyo' }),
  })
  if (!result.ok) return result

  const id = String(result.data.id ?? '')
  return id ? { ok: true, data: id } : fail('request_failed', 'calendar id missing')
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  event: unknown,
): Promise<GoogleResult<string>> {
  const result = await callApi(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(event) },
  )
  if (!result.ok) return result

  const id = String(result.data.id ?? '')
  return id ? { ok: true, data: id } : fail('request_failed')
}

export type RemoteChange = {
  id: string
  status: string
  start: string | null
  end: string | null
}

/**
 * 前回以降に変わった予定を取る。
 * 印が無ければ全件を取り、次回のための印を受け取る。
 */
export async function listChanges(
  accessToken: string,
  calendarId: string,
  syncToken: string,
): Promise<GoogleResult<{ changes: RemoteChange[]; nextSyncToken: string }>> {
  const params = new URLSearchParams({ showDeleted: 'true', maxResults: '2500' })
  if (syncToken) params.set('syncToken', syncToken)
  else params.set('singleEvents', 'true')

  const result = await callApi(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  )
  if (!result.ok) return result

  const items = Array.isArray(result.data.items) ? result.data.items : []

  const changes: RemoteChange[] = items.map((item) => {
    const event = item as {
      id?: string
      status?: string
      start?: { dateTime?: string }
      end?: { dateTime?: string }
    }

    return {
      id: String(event.id ?? ''),
      status: String(event.status ?? 'confirmed'),
      start: event.start?.dateTime ?? null,
      end: event.end?.dateTime ?? null,
    }
  })

  return {
    ok: true,
    data: { changes, nextSyncToken: String(result.data.nextSyncToken ?? '') },
  }
}
