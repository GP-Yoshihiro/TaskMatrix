/** アプリケーション全体で使用するエラーコード */
export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'PROJECT_LIMIT_EXCEEDED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'STORAGE_ERROR'
  | 'AI_NOT_CONFIGURED'
  | 'TEXT_TOO_LONG'
  | 'TEXT_EXTRACTION_FAILED'
  | 'AI_REQUEST_FAILED'
  | 'AI_MODEL_UNAVAILABLE'
  | 'AI_RESPONSE_INVALID'
  | 'NO_SCHEDULABLE_TASKS'
  | 'INVALID_SCHEDULE_RANGE'
  | 'UNKNOWN'

export type AppError = {
  code: AppErrorCode
  /** 利用者にそのまま表示できる日本語メッセージ */
  message: string
}

/** 成功と失敗を型で判別できる戻り値。例外を UI に投げないための土台 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err(code: AppErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } }
}
