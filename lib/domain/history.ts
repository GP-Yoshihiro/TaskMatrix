import { diffLines } from './diff'
import { normalizeLineEndings } from './files'

/**
 * 変更履歴。
 *
 * 全文は保存せず、変更箇所だけを持つ。
 * 履歴は半永久に残すため、毎回全文を持つと容量が早く尽きる。
 */

export type HistoryAction = 'created' | 'updated' | 'deleted'

export const ACTION_LABEL: Record<HistoryAction, string> = {
  created: '追加',
  updated: '編集',
  deleted: '削除',
}

/**
 * 1 件の履歴に保存する変更行の上限。
 *
 * 巨大なファイルを丸ごと書き換えると変更行が数万件になり、
 * 1 件の履歴だけで容量を食い尽くしてしまう。
 */
export const MAX_STORED_CHANGES = 300

export type Change = {
  type: 'added' | 'removed'
  /** 追加は変更後、削除は変更前の行番号（1 始まり） */
  line: number
  text: string
}

export type ChangeSet = {
  changes: Change[]
  addedCount: number
  removedCount: number
  /** 上限を超えて一部しか保存していないか */
  truncated: boolean
}

/**
 * 末尾に改行を足して比較の土台を揃える。
 *
 * 差分ライブラリは末尾に改行が無いと最終行を「変更」として扱う。
 * 1 行足しただけで「最終行を削除して 2 行追加」と報告されてしまい、
 * 変更行数が実態とずれる。
 */
function withTrailingNewline(text: string): string {
  if (text === '') return ''
  return text.endsWith('\n') ? text : `${text}\n`
}

/**
 * 変更箇所を取り出す。
 *
 * 行番号のズレは厳密に合わせない（利用者と合意済み）。
 * 保存する行数には上限を設けるが、**行数の集計は打ち切らない**。
 * 集計まで打ち切ると、変更の規模が分からなくなるため。
 */
export function buildChangeSet(oldText: string, newText: string): ChangeSet {
  // 編集環境の違いで全行が変わったように見えるのを防ぐ
  const lines = diffLines(
    withTrailingNewline(normalizeLineEndings(oldText)),
    withTrailingNewline(normalizeLineEndings(newText)),
  )

  const changes: Change[] = []
  let addedCount = 0
  let removedCount = 0
  let oldLine = 1
  let newLine = 1

  for (const line of lines) {
    if (line.type === 'unchanged') {
      oldLine += 1
      newLine += 1
      continue
    }

    if (line.type === 'added') {
      addedCount += 1
      if (changes.length < MAX_STORED_CHANGES) {
        changes.push({ type: 'added', line: newLine, text: line.value })
      }
      newLine += 1
      continue
    }

    removedCount += 1
    if (changes.length < MAX_STORED_CHANGES) {
      changes.push({ type: 'removed', line: oldLine, text: line.value })
    }
    oldLine += 1
  }

  return {
    changes,
    addedCount,
    removedCount,
    truncated: addedCount + removedCount > MAX_STORED_CHANGES,
  }
}

/** 一覧に出す変更の要約 */
export function summarizeChanges(input: {
  addedCount: number
  removedCount: number
  truncated: boolean
}): string {
  const parts: string[] = []
  if (input.addedCount > 0) parts.push(`+${input.addedCount}`)
  if (input.removedCount > 0) parts.push(`−${input.removedCount}`)

  if (parts.length === 0) return '変更なし'

  const summary = `${parts.join(' ')} 行`
  return input.truncated ? `${summary}（一部のみ保存）` : summary
}

/**
 * ファイル形式ごとの色。
 * 一覧を目で追うとき、形式が色で分かると探しやすい。
 */
const EXTENSION_COLOR: Record<string, string> = {
  md: '#4c8dff',
  txt: '#8e8e93',
  xlsx: '#34a853',
  docx: '#2b6cb0',
  pptx: '#dd6b20',
  pdf: '#d93025',
}

const UNKNOWN_COLOR = '#a0a0a5'

export function fileColor(extension: string): string {
  return EXTENSION_COLOR[extension.toLowerCase()] ?? UNKNOWN_COLOR
}

/**
 * 一覧を 1 回に読む件数。無限スクロールで継ぎ足す単位。
 *
 * 'use server' のファイルは非同期関数以外を export できないため、ここに置く。
 */
export const HISTORY_PAGE_SIZE = 50
