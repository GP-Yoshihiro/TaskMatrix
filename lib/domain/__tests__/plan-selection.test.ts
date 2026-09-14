import { describe, expect, it } from 'vitest'
import {
  MAX_PLAN_TASKS,
  needsSelection,
  pickTasksToPlan,
  validatePlanSelection,
} from '../plan-selection'

function tasks(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `t${index}` }))
}

describe('MAX_PLAN_TASKS', () => {
  it('1 度に扱う上限は 100', () => {
    // 多すぎると AI の応答が返らず、時間切れで中断する
    expect(MAX_PLAN_TASKS).toBe(100)
  })
})

describe('needsSelection', () => {
  it('上限を超えていれば、選んでもらう', () => {
    expect(needsSelection(MAX_PLAN_TASKS + 1)).toBe(true)
  })

  it('ちょうど上限なら、選ばなくてよい', () => {
    expect(needsSelection(MAX_PLAN_TASKS)).toBe(false)
  })

  it('少なければ選ばなくてよい', () => {
    expect(needsSelection(3)).toBe(false)
  })
})

describe('validatePlanSelection', () => {
  it('上限内なら通す', () => {
    expect(validatePlanSelection(['a', 'b'], 200).ok).toBe(true)
  })

  it('上限を超える選択は通さない', () => {
    // 通すと、また時間切れで中断する
    const result = validatePlanSelection(
      Array.from({ length: MAX_PLAN_TASKS + 1 }, (_, i) => `t${i}`),
      500,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('100')
  })

  it('選択が空でも、上限内の件数なら通す', () => {
    // 少ないときは選ばずに全件で算出できる
    expect(validatePlanSelection([], 50).ok).toBe(true)
  })

  it('選択が空で、上限を超えていれば通さない', () => {
    const result = validatePlanSelection([], 200)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('選んで')
  })
})

describe('pickTasksToPlan', () => {
  it('選択があれば、その順で絞る', () => {
    const picked = pickTasksToPlan(tasks(5), ['t3', 't1'])
    expect(picked.map((task) => task.id)).toEqual(['t1', 't3'])
  })

  it('選択が空なら、全件を返す', () => {
    expect(pickTasksToPlan(tasks(4), [])).toHaveLength(4)
  })

  it('存在しない識別子は無視する', () => {
    // 消えたタスクを選んだまま実行しても壊さない
    expect(pickTasksToPlan(tasks(3), ['t1', 'zzz']).map((t) => t.id)).toEqual(['t1'])
  })

  it('選択が空で、上限を超える件数なら、上限までに切る', () => {
    // 念のための歯止め。画面側で選ばせるのが本筋
    expect(pickTasksToPlan(tasks(150), [])).toHaveLength(MAX_PLAN_TASKS)
  })

  it('元の並びを保つ', () => {
    expect(pickTasksToPlan(tasks(5), ['t4', 't0', 't2']).map((t) => t.id)).toEqual([
      't0',
      't2',
      't4',
    ])
  })
})
