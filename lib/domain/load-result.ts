/**
 * 画面の取得が失敗したときの扱い。
 *
 * サーバー側の取得が 1 つでも例外を投げると、画面全体が出なくなる。
 * 移行 SQL の適用漏れや一時的な障害で、何も見えず原因も分からない状態になる。
 *
 * 取得ごとに包み、**読めなかった箇所だけを知らせて残りは出す。**
 */

export type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; fallback: T; error: string }

/**
 * 取得を試し、失敗したら代わりの値に落とす。
 *
 * 成否は例外の有無だけで決める。値の中身で判断すると、
 * 正当な空の結果（0 件・null）を失敗として扱ってしまう。
 */
export async function attempt<T>(
  load: () => Promise<T> | T,
  fallback?: T,
  label = '',
): Promise<LoadResult<T>> {
  try {
    return { ok: true, data: await load() }
  } catch {
    return { ok: false, fallback: fallback as T, error: label }
  }
}

/**
 * 最初の失敗の名前。すべて成功なら null。
 *
 * 複数並べても、利用者に伝えるべきことは「読めなかった」の一言でよい。
 */
export function firstFailure(results: LoadResult<unknown>[]): string | null {
  const failed = results.find((result) => !result.ok)
  return failed && !failed.ok ? failed.error : null
}
