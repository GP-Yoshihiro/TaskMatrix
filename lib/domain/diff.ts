import { diffLines as computeDiff } from 'diff'

export type DiffLine = {
  type: 'added' | 'removed' | 'unchanged'
  value: string
}

/**
 * 2 つのテキストを行単位で比較する。
 * 各ブロックの末尾に生じる空要素は差分として扱わない。
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const parts = computeDiff(oldText, newText)
  const result: DiffLine[] = []

  for (const part of parts) {
    const type: DiffLine['type'] = part.added
      ? 'added'
      : part.removed
        ? 'removed'
        : 'unchanged'

    const lines = part.value.split('\n')
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

    for (const value of lines) {
      result.push({ type, value })
    }
  }

  return result
}
