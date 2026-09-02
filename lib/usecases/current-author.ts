import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveAuthorName } from '@/lib/domain/profile'

/**
 * 履歴に焼き込む変更者名を求める。
 *
 * アカウントが消えたあとでも「誰の操作か」が残るよう、記録時点の名前を持つ。
 * 読めなかった場合も操作を止めない（履歴は付随的な情報のため）。
 */
export async function readAuthorName(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', userId)
      .maybeSingle()

    const row = data as { display_name: string | null; email: string | null } | null

    return resolveAuthorName({
      displayName: row?.display_name ?? null,
      email: row?.email ?? null,
      snapshot: '',
    })
  } catch {
    return '不明'
  }
}
