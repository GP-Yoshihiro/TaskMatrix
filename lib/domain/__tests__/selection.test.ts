import { describe, expect, it } from 'vitest'
import { allSelected, selectionSummary, toggleAll, toggleOne } from '../selection'

const IDS = ['a', 'b', 'c']

describe('toggleOne', () => {
  it('入っていなければ加える', () => {
    expect([...toggleOne(new Set(['a']), 'b')].sort()).toEqual(['a', 'b'])
  })

  it('入っていれば外す', () => {
    expect([...toggleOne(new Set(['a', 'b']), 'a')]).toEqual(['b'])
  })

  it('元の集合を変えない', () => {
    // 状態をその場で書き換えると、描き直しが起きない
    const original = new Set(['a'])
    toggleOne(original, 'b')
    expect([...original]).toEqual(['a'])
  })
})

describe('toggleAll', () => {
  it('全部選ばれていなければ、全部選ぶ', () => {
    expect([...toggleAll(new Set(['a']), IDS)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('全部選ばれていれば、全部外す', () => {
    expect([...toggleAll(new Set(IDS), IDS)]).toEqual([])
  })

  it('表示されていないものは触らない', () => {
    // 絞り込みの外にあるものを、知らないうちに消させない
    const result = toggleAll(new Set(['z']), IDS)
    expect(result.has('z')).toBe(true)
  })

  it('表示が空なら何も起きない', () => {
    expect([...toggleAll(new Set(['a']), [])]).toEqual(['a'])
  })
})

describe('allSelected', () => {
  it('表示中がすべて選ばれていれば真', () => {
    expect(allSelected(new Set(IDS), IDS)).toBe(true)
  })

  it('1 つでも欠ければ偽', () => {
    expect(allSelected(new Set(['a', 'b']), IDS)).toBe(false)
  })

  it('表示が空なら偽', () => {
    // 何も無いのに「全部選択済み」と見せない
    expect(allSelected(new Set(['a']), [])).toBe(false)
  })
})

describe('selectionSummary', () => {
  it('選んだ件数を伝える', () => {
    expect(selectionSummary(new Set(['a', 'b']), IDS)).toContain('2 件')
  })

  it('表示中のものだけを数える', () => {
    // 絞り込みで隠れているものを数に入れると、消える数と合わない
    expect(selectionSummary(new Set(['a', 'z']), IDS)).toContain('1 件')
  })

  it('選んでいなければ、その旨を伝える', () => {
    expect(selectionSummary(new Set(), IDS)).toContain('選んでいません')
  })
})
