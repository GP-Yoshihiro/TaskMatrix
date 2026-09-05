/**
 * 利用上限に達したことの通知。
 *
 * AI の費用は運用者（親）がまとめて負担している。
 * 子が上限に達して機能が止まったことを、親が知る手立てが要る。
 */

/** 何の上限に達したか */
export type LimitReason = 'calls' | 'tokens'

/** 日本標準時の UTC からの差 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 日本時間の日付（YYYY-MM-DD）。
 *
 * 1 人 1 日 1 件にまとめる鍵として使う。上限は日本時間で区切っているため、
 * ここも合わせないと日付がずれた通知が二重に残る。
 */
export function jstDateKey(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 親に見せる一言 */
export function noticeMessage(reason: LimitReason): string {
  return reason === 'calls'
    ? '本日の実行回数の上限に達し、AI の機能が止まっています。'
    : '本日の使用量の上限に達し、AI の機能が止まっています。'
}
