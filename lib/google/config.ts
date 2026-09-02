/**
 * Google 連携の設定。
 *
 * いずれもサーバー専用。NEXT_PUBLIC_ を付けない（R-14）。
 * 欠けていれば null を返し、呼び出し側が「未設定」と伝えられるようにする。
 */
export type GoogleConfig = {
  clientId: string
  clientSecret: string
  encryptionKey: string
}

export function readGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const encryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY

  if (!clientId || !clientSecret || !encryptionKey) return null

  return { clientId, clientSecret, encryptionKey }
}

/** リダイレクト URI は Google Cloud 側の登録と一字一句同じである必要がある */
export function buildRedirectUri(origin: string): string {
  return `${origin}/api/google/callback`
}
