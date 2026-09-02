/**
 * 変更履歴の絞り込み条件。
 *
 * 画面の問い合わせ（クエリ）と相互に変換できるようにして、
 * 絞り込んだ状態のまま共有・再読込ができるようにする。
 */

export type HistoryFilter = {
  /** ファイル名の部分一致 */
  fileName: string
  /** 拡張子の完全一致（小文字） */
  extension: string
  /** 期間の開始（YYYY-MM-DD） */
  from: string
  /** 期間の終了（YYYY-MM-DD） */
  to: string
  /** タグ名の完全一致 */
  tag: string
}

export const EMPTY_FILTER: HistoryFilter = {
  fileName: '',
  extension: '',
  from: '',
  to: '',
  tag: '',
}

export function isEmptyFilter(filter: HistoryFilter): boolean {
  return (
    filter.fileName.trim() === '' &&
    filter.extension.trim() === '' &&
    filter.from.trim() === '' &&
    filter.to.trim() === '' &&
    filter.tag.trim() === ''
  )
}

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * 年月をその月の初日と末日に変換する。
 *
 * 末日は月ごとに違い、うるう年の 2 月もある。
 * 30 日で決め打ちすると必ず取りこぼすため、翌月の 0 日目から求める。
 */
export function monthToRange(month: string): { from: string; to: string } {
  const matched = MONTH_PATTERN.exec(month.trim())
  if (!matched) return { from: '', to: '' }

  const year = Number(matched[1])
  const monthNumber = Number(matched[2])

  // Date.UTC の day に 0 を渡すと前月の末日になる
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()

  return {
    from: `${matched[1]}-${matched[2]}-01`,
    to: `${matched[1]}-${matched[2]}-${pad(lastDay)}`,
  }
}

export function validateRange(from: string, to: string): string | null {
  const start = from.trim()
  const end = to.trim()

  if (!start || !end) return null
  if (start > end) return '開始日は終了日より前にしてください。'

  return null
}

export function parseFilter(params: URLSearchParams): HistoryFilter {
  return {
    fileName: (params.get('fileName') ?? '').trim(),
    // 大文字で入力しても引けるようにする
    extension: (params.get('extension') ?? '').trim().toLowerCase(),
    from: (params.get('from') ?? '').trim(),
    to: (params.get('to') ?? '').trim(),
    tag: (params.get('tag') ?? '').trim(),
  }
}

export function toSearchParams(filter: HistoryFilter): URLSearchParams {
  const params = new URLSearchParams()

  // 空の項目は付けない。URL を読みやすく保つため
  if (filter.fileName.trim()) params.set('fileName', filter.fileName.trim())
  if (filter.extension.trim()) params.set('extension', filter.extension.trim())
  if (filter.from.trim()) params.set('from', filter.from.trim())
  if (filter.to.trim()) params.set('to', filter.to.trim())
  if (filter.tag.trim()) params.set('tag', filter.tag.trim())

  return params
}
