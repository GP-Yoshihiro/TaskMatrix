import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

/** Next.js 16 で middleware から改称された。ランタイムは nodejs 固定。 */
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
