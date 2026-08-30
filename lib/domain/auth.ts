import { z } from 'zod'
import { type Result, err, ok } from './result'

/** パスワードの最小文字数 */
export const PASSWORD_MIN_LENGTH = 8

const schema = z.object({
  email: z.email().trim(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
})

export function validateCredentials(
  email: string,
  password: string,
): Result<{ email: string; password: string }> {
  const parsed = schema.safeParse({ email: email.trim(), password })

  if (!parsed.success) {
    const hasEmailIssue = parsed.error.issues.some((issue) => issue.path[0] === 'email')
    return err(
      'VALIDATION_ERROR',
      hasEmailIssue
        ? 'メールアドレスの形式が正しくありません。'
        : `パスワードは ${PASSWORD_MIN_LENGTH} 文字以上で入力してください。`,
    )
  }

  return ok(parsed.data)
}
