import { NextResponse } from 'next/server'
import type { AppError } from '@/lib/domain/result'

/**
 * API の応答をまとめる。
 *
 * 認証失敗は理由を書き分けない。トークンは応答にもログにも出さない。
 * 一覧が古いまま返らないよう、すべて no-store とする。
 */
const NO_STORE = { 'Cache-Control': 'no-store' }

export function apiOk(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export function apiError(
  error: AppError,
  status: number,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { error: { code: error.code, message: error.message } },
    { status, headers: { ...NO_STORE, ...extraHeaders } },
  )
}

/** サーバー専用キーが無いときの応答。黙って失敗させず、設定不備だと伝える */
export function apiNotConfigured(): NextResponse {
  return apiError(
    {
      code: 'SERVICE_NOT_CONFIGURED',
      message: 'サーバーの設定が不足しているため、この API は利用できません。',
    },
    503,
  )
}
