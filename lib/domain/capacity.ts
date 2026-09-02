/**
 * 容量の監視。
 *
 * 履歴は半永久に残す。期限では消さず、
 * データベースが上限に近づいたときだけ古い順に消す。
 */

/** Supabase 無料枠のデータベース容量 */
export const CAPACITY_LIMIT_BYTES = 500 * 1024 * 1024

/**
 * 消し始める割合。
 * 上限ちょうどまで待つと、書き込めなくなってから気付くことになる。
 */
export const CAPACITY_THRESHOLD = 0.8

/** 1 回に消す件数。一度に大量に消すと処理が長引く */
export const PURGE_BATCH = 200

export function needsPurge(usedBytes: number): boolean {
  return usedBytes > CAPACITY_LIMIT_BYTES * CAPACITY_THRESHOLD
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/** 「12 MB / 500 MB（2%）」の形で示す */
export function formatUsage(usedBytes: number): string {
  const percent = Math.round((usedBytes / CAPACITY_LIMIT_BYTES) * 100)

  return `${formatBytes(usedBytes)} / ${formatBytes(CAPACITY_LIMIT_BYTES)}（${percent}%）`
}
