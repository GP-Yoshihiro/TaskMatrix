/**
 * サイドバーの開閉。
 *
 * 広い画面でも閉じられるようにし、選んだ状態を次回以降も保つ。
 * 毎回閉じ直させるのは手間になる。
 */

export const SIDEBAR_STORAGE_KEY = 'taskmatrix-sidebar-collapsed'

/**
 * 記憶した開閉状態を読む。
 * 既定は「開いている」。初めての利用者に移動先が見えている方がよい。
 */
export function readCollapsed(read: () => string | null): boolean {
  try {
    return read() === 'true'
  } catch {
    // 保存が使えない環境でも表示は続ける
    return false
  }
}
