import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest, NextResponse } from 'next/server'
import { createSupabaseApiTokenRepository } from '@/lib/repositories/api-tokens'
import { createServiceSupabaseClient } from '@/lib/supabase/service'
import { type TokenAuth, authenticateToken } from '@/lib/usecases/authenticate-token'
import { apiError, apiNotConfigured } from './respond'

export type Authenticated = {
  auth: TokenAuth
  supabase: SupabaseClient
}

/**
 * 連携トークンで認証する。
 *
 * 成功すると、操作できるプロジェクトとサーバー専用クライアントを返す。
 * このクライアントは RLS を通らないため、
 * **呼び出し側は必ず auth.projectId で問い合わせを絞ること**。
 */
export async function authenticateRequest(
  request: NextRequest,
): Promise<Authenticated | NextResponse> {
  const supabase = createServiceSupabaseClient()
  if (!supabase) return apiNotConfigured()

  const result = await authenticateToken(
    createSupabaseApiTokenRepository(supabase),
    request.headers.get('authorization'),
    new Date(),
  )

  if (!result.ok) {
    if (result.error.code === 'RATE_LIMITED') {
      return apiError(result.error, 429, {
        'Retry-After': String(result.retryAfterSeconds),
      })
    }
    return apiError(result.error, 401)
  }

  return { auth: result.data, supabase }
}
