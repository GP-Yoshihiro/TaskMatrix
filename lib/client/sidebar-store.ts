import { SIDEBAR_STORAGE_KEY, readCollapsed } from '@/lib/domain/sidebar-state'

/**
 * サイドバーの開閉を、画面の外の状態として持つ。
 *
 * 状態更新の関数の中で保存すると、React が更新関数を複数回呼んだときに
 * 保存された値と表示が食い違う。読み書きをここに集め、
 * 画面側は `useSyncExternalStore` で読むだけにする。
 */

const listeners = new Set<() => void>()

/** 読むたびに保存を触らないための控え。同じ状態では同じ値を返す必要がある */
let cache: boolean | null = null

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): boolean {
  if (cache === null) {
    cache = readCollapsed(() => window.localStorage.getItem(SIDEBAR_STORAGE_KEY))
  }
  return cache
}

/** サーバーでは開いた状態で描く。初めての利用者に移動先が見えている方がよい */
export function getServerSnapshot(): boolean {
  return false
}

export function setCollapsed(next: boolean): void {
  cache = next

  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
  } catch {
    // 保存が使えなくても、その場の開閉はできる
  }

  for (const listener of listeners) listener()
}
