import { describe, expect, it } from 'vitest'
import { mergeGroup, applyGroups, type SuggestionLike } from '../merge-suggestions'

function suggestion(overrides: Partial<SuggestionLike> = {}): SuggestionLike {
  return {
    key: 'k1',
    title: '見積もりを提出する',
    description: '',
    priority: 'medium',
    assignee: '',
    dueDate: null,
    ambiguityNote: '',
    aiSuggestion: '',
    estimatedDays: null,
    estimateSource: '',
    sourceFileName: '資料A',
    ...overrides,
  }
}

describe('mergeGroup', () => {
  it('1 件だけならそのまま返す', () => {
    const only = suggestion()
    expect(mergeGroup([only]).title).toBe(only.title)
  })

  it('説明は長い方を採る', () => {
    // 短い方を採ると、書かれていた条件が落ちる
    const merged = mergeGroup([
      suggestion({ description: '短い' }),
      suggestion({ key: 'k2', description: '長いほうの説明で、条件が書いてある' }),
    ])
    expect(merged.description).toBe('長いほうの説明で、条件が書いてある')
  })

  it('優先度は高い方を採る', () => {
    // 低い方に寄せると、急ぎの作業を見落とす
    expect(
      mergeGroup([suggestion({ priority: 'low' }), suggestion({ key: 'k2', priority: 'high' })])
        .priority,
    ).toBe('high')
  })

  it('期限は早い方を採る', () => {
    // 遅い方に寄せると、間に合わなくなる
    expect(
      mergeGroup([
        suggestion({ dueDate: '2026-10-01' }),
        suggestion({ key: 'k2', dueDate: '2026-09-20' }),
      ]).dueDate,
    ).toBe('2026-09-20')
  })

  it('期限が片方だけなら、それを採る', () => {
    expect(
      mergeGroup([suggestion({ dueDate: null }), suggestion({ key: 'k2', dueDate: '2026-09-20' })])
        .dueDate,
    ).toBe('2026-09-20')
  })

  it('想定日程は長い方を採る', () => {
    // 短く見積もると、日程が破綻する
    expect(
      mergeGroup([
        suggestion({ estimatedDays: 1 }),
        suggestion({ key: 'k2', estimatedDays: 3 }),
      ]).estimatedDays,
    ).toBe(3)
  })

  it('担当は、入っている方を採る', () => {
    expect(
      mergeGroup([suggestion({ assignee: '' }), suggestion({ key: 'k2', assignee: '田中' })])
        .assignee,
    ).toBe('田中')
  })

  it('不明な点は、すべて残す', () => {
    // どちらかを捨てると、確かめるべきことが消える
    const merged = mergeGroup([
      suggestion({ ambiguityNote: '期限が曖昧' }),
      suggestion({ key: 'k2', ambiguityNote: '担当が未定' }),
    ])
    expect(merged.ambiguityNote).toContain('期限が曖昧')
    expect(merged.ambiguityNote).toContain('担当が未定')
  })

  it('同じ不明点は重ねない', () => {
    const merged = mergeGroup([
      suggestion({ ambiguityNote: '期限が曖昧' }),
      suggestion({ key: 'k2', ambiguityNote: '期限が曖昧' }),
    ])
    expect(merged.ambiguityNote).toBe('期限が曖昧')
  })

  it('どの資料から来たかを、すべて残す', () => {
    // まとめた根拠を後から確かめられるようにする
    const merged = mergeGroup([
      suggestion({ sourceFileName: '資料A' }),
      suggestion({ key: 'k2', sourceFileName: '資料B' }),
    ])
    expect(merged.mergedFrom).toEqual(['資料A', '資料B'])
  })

  it('まとめた件数を持つ', () => {
    expect(mergeGroup([suggestion(), suggestion({ key: 'k2' })]).mergedCount).toBe(2)
  })

  it('1 件のときは、まとめた印を付けない', () => {
    expect(mergeGroup([suggestion()]).mergedCount).toBe(1)
  })
})

describe('applyGroups', () => {
  const items = [
    suggestion({ key: 'a', title: '見積もりを出す' }),
    suggestion({ key: 'b', title: '見積書を提出' }),
    suggestion({ key: 'c', title: '議事録を作る' }),
  ]

  it('同じ組に入ったものをまとめる', () => {
    const result = applyGroups(items, [['a', 'b']])
    expect(result).toHaveLength(2)
    expect(result.find((item) => item.mergedCount === 2)).toBeDefined()
  })

  it('組に入らなかったものは、そのまま残す', () => {
    const result = applyGroups(items, [['a', 'b']])
    expect(result.some((item) => item.title === '議事録を作る')).toBe(true)
  })

  it('組が空なら、何もまとめない', () => {
    expect(applyGroups(items, [])).toHaveLength(3)
  })

  it('知らない識別子は無視する', () => {
    // AI が実在しない鍵を返しても壊さない
    expect(applyGroups(items, [['a', 'zzz']])).toHaveLength(3)
  })

  it('1 件だけの組は、まとめたことにしない', () => {
    const result = applyGroups(items, [['a']])
    expect(result.every((item) => item.mergedCount === 1)).toBe(true)
  })

  it('同じものを 2 つの組に入れても、二重に出さない', () => {
    // 先の組を採る。重複して並ぶより、取りこぼさない方を優先する
    const result = applyGroups(items, [['a', 'b'], ['b', 'c']])
    const keys = result.flatMap((item) => item.mergedKeys)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
