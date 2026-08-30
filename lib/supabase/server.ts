import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Server Component / Server Action 用の Supabase クライアント */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component からの呼び出しでは書き込めない。
            // セッション更新は proxy が担うため無視してよい。
          }
        },
      },
    },
  )
}
