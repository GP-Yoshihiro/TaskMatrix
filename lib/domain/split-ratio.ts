/**
 * 分割表示の比率。
 *
 * 一度変えた比率は記憶し、以降も適用する。
 * 端に寄せきると片方が読めなくなるため、上下限を設ける。
 */

export const DEFAULT_RATIO = 0.5
export const MIN_RATIO = 0.2
export const MAX_RATIO = 0.8

export const RATIO_STORAGE_KEY = 'taskmatrix-history-split'

export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RATIO
  return Math.min(Math.max(value, MIN_RATIO), MAX_RATIO)
}

/**
 * 記憶した比率を読む。
 * 壊れた値・範囲外・保存が使えない環境では既定値に戻す。
 */
export function readRatio(read: () => string | null): number {
  try {
    const stored = read()
    if (stored === null) return DEFAULT_RATIO

    const parsed = Number.parseFloat(stored)
    if (Number.isNaN(parsed)) return DEFAULT_RATIO

    return clampRatio(parsed)
  } catch {
    // 保存が使えない環境でも表示は続ける
    return DEFAULT_RATIO
  }
}

/** ドラッグ位置から比率を求める */
export function ratioFromPosition(pointerX: number, left: number, width: number): number {
  if (width <= 0) return DEFAULT_RATIO
  return clampRatio((pointerX - left) / width)
}
