import { describe, expect, it } from 'vitest'
import {
  ACTION_LABEL,
  MAX_STORED_CHANGES,
  buildChangeSet,
  fileColor,
  summarizeChanges,
} from '../history'

describe('buildChangeSet', () => {
  it('変更が無ければ空の変更集合を返す', () => {
    const result = buildChangeSet('あ\nい\nう', 'あ\nい\nう')

    expect(result).toEqual({
      changes: [],
      addedCount: 0,
      removedCount: 0,
      truncated: false,
    })
  })

  it('追加された行を数える', () => {
    const result = buildChangeSet('あ\nい', 'あ\nい\nう')

    expect(result.addedCount).toBe(1)
    expect(result.removedCount).toBe(0)
    expect(result.changes).toEqual([{ type: 'added', line: 3, text: 'う' }])
  })

  it('削除された行を数える', () => {
    const result = buildChangeSet('あ\nい\nう', 'あ\nい')

    expect(result.addedCount).toBe(0)
    expect(result.removedCount).toBe(1)
    expect(result.changes).toEqual([{ type: 'removed', line: 3, text: 'う' }])
  })

  it('置き換えは削除と追加の両方として数える', () => {
    const result = buildChangeSet('あ\nい', 'あ\nX')

    expect(result.addedCount).toBe(1)
    expect(result.removedCount).toBe(1)
  })

  it('追加行は変更後の行番号を持つ', () => {
    // 先頭に 1 行足すと、それ以降の行番号がずれる。
    // 追加行そのものは変更後の位置（1 行目）で記録する
    const result = buildChangeSet('い\nう', 'あ\nい\nう')
    const added = result.changes.filter((c) => c.type === 'added')

    expect(added).toEqual([{ type: 'added', line: 1, text: 'あ' }])
  })

  it('削除行は変更前の行番号を持つ', () => {
    const result = buildChangeSet('あ\nい\nう', 'あ\nう')
    const removed = result.changes.filter((c) => c.type === 'removed')

    expect(removed).toEqual([{ type: 'removed', line: 2, text: 'い' }])
  })

  it('空から書き始めた場合も追加として数える', () => {
    const result = buildChangeSet('', 'あ\nい')

    expect(result.addedCount).toBe(2)
    expect(result.removedCount).toBe(0)
  })

  it('全文を消した場合も削除として数える', () => {
    const result = buildChangeSet('あ\nい', '')

    expect(result.addedCount).toBe(0)
    expect(result.removedCount).toBe(2)
  })

  it('変更が多すぎるときは保存する行を打ち切る', () => {
    // 巨大な書き換えで 1 件の履歴が容量を食い尽くすのを防ぐ
    const before = ''
    const after = Array.from({ length: MAX_STORED_CHANGES + 50 }, (_, i) => `行${i}`).join(
      '\n',
    )

    const result = buildChangeSet(before, after)

    expect(result.truncated).toBe(true)
    expect(result.changes).toHaveLength(MAX_STORED_CHANGES)
  })

  it('打ち切っても行数は正確に数える', () => {
    // 「何行変わったか」まで打ち切ると、変更の規模が分からなくなる
    const total = MAX_STORED_CHANGES + 50
    const after = Array.from({ length: total }, (_, i) => `行${i}`).join('\n')

    const result = buildChangeSet('', after)

    expect(result.addedCount).toBe(total)
  })

  it('上限ちょうどなら打ち切らない', () => {
    const after = Array.from({ length: MAX_STORED_CHANGES }, (_, i) => `行${i}`).join('\n')
    const result = buildChangeSet('', after)

    expect(result.truncated).toBe(false)
    expect(result.changes).toHaveLength(MAX_STORED_CHANGES)
  })

  it('改行コードの違いだけでは変更としない', () => {
    // 編集環境の違いで全行が変わったように見えるのを防ぐ
    expect(buildChangeSet('あ\r\nい', 'あ\nい').changes).toEqual([])
  })
})

describe('summarizeChanges', () => {
  it('追加と削除の行数を示す', () => {
    expect(summarizeChanges({ addedCount: 3, removedCount: 1, truncated: false })).toBe(
      '+3 −1 行',
    )
  })

  it('追加だけなら追加のみ示す', () => {
    expect(summarizeChanges({ addedCount: 3, removedCount: 0, truncated: false })).toBe(
      '+3 行',
    )
  })

  it('削除だけなら削除のみ示す', () => {
    expect(summarizeChanges({ addedCount: 0, removedCount: 2, truncated: false })).toBe(
      '−2 行',
    )
  })

  it('変更が無ければその旨を示す', () => {
    expect(summarizeChanges({ addedCount: 0, removedCount: 0, truncated: false })).toBe(
      '変更なし',
    )
  })

  it('打ち切られていれば一部しか保存していないと分かるようにする', () => {
    const text = summarizeChanges({ addedCount: 400, removedCount: 0, truncated: true })

    expect(text).toContain('+400 行')
    expect(text).toContain('一部')
  })
})

describe('fileColor', () => {
  it('同じ拡張子には同じ色を返す', () => {
    expect(fileColor('md')).toBe(fileColor('md'))
  })

  it('違う拡張子には違う色を返す', () => {
    expect(fileColor('md')).not.toBe(fileColor('xlsx'))
  })

  it('大文字small文字の違いを無視する', () => {
    expect(fileColor('MD')).toBe(fileColor('md'))
  })

  it('未知の拡張子でも色を返す', () => {
    expect(fileColor('zzz')).toMatch(/^#|^var\(/)
  })

  it('拡張子が無くても色を返す', () => {
    expect(fileColor('')).toMatch(/^#|^var\(/)
  })
})

describe('ACTION_LABEL', () => {
  it('3 つの操作に日本語の名前がある', () => {
    expect(ACTION_LABEL.created).toBe('追加')
    expect(ACTION_LABEL.updated).toBe('編集')
    expect(ACTION_LABEL.deleted).toBe('削除')
  })
})
