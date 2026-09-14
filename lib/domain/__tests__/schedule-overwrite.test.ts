import { describe, expect, it } from 'vitest'
import { findDuplicateTasks, overwriteTargetIds } from '../schedule-overwrite'

const CONFIRMED = [
  { id: 's1', taskId: 't1', taskTitle: '基礎工事', googleEventId: '' },
  { id: 's2', taskId: 't1', taskTitle: '基礎工事', googleEventId: 'g2' },
  { id: 's3', taskId: 't2', taskTitle: '内装', googleEventId: '' },
]

function draft(taskId: string, taskTitle: string) {
  return { key: `k-${taskId}`, taskId, taskTitle }
}

describe('findDuplicateTasks', () => {
  it('既に予定があるタスクを拾う', () => {
    const found = findDuplicateTasks([draft('t1', '基礎工事')], CONFIRMED)
    expect(found).toHaveLength(1)
    expect(found[0].taskTitle).toBe('基礎工事')
  })

  it('同じタスクの既存予定の件数を添える', () => {
    // 何件が置き換わるのかを、押す前に伝える
    expect(findDuplicateTasks([draft('t1', '基礎工事')], CONFIRMED)[0].existingCount).toBe(2)
  })

  it('予定が無いタスクは拾わない', () => {
    expect(findDuplicateTasks([draft('t9', '新規')], CONFIRMED)).toHaveLength(0)
  })

  it('確定済みが空なら、重複は無い', () => {
    expect(findDuplicateTasks([draft('t1', '基礎工事')], [])).toHaveLength(0)
  })

  it('同じタスクの仮案が複数あっても、1 つにまとめる', () => {
    // 同じ見出しを 2 度出すと、何件消えるのか分からなくなる
    const found = findDuplicateTasks(
      [draft('t1', '基礎工事'), draft('t1', '基礎工事')],
      CONFIRMED,
    )
    expect(found).toHaveLength(1)
  })

  it('Google に送済みのものが含まれるかを示す', () => {
    // カレンダー側も消えることを、押す前に伝える必要がある
    expect(findDuplicateTasks([draft('t1', '基礎工事')], CONFIRMED)[0].hasGoogleEvent).toBe(
      true,
    )
    expect(findDuplicateTasks([draft('t2', '内装')], CONFIRMED)[0].hasGoogleEvent).toBe(false)
  })
})

describe('overwriteTargetIds', () => {
  it('置き換える対象の予定 ID を返す', () => {
    expect(overwriteTargetIds([draft('t1', '基礎工事')], CONFIRMED)).toEqual(['s1', 's2'])
  })

  it('選ばれていないタスクの予定は含めない', () => {
    // 選んでいない予定まで消してはいけない
    expect(overwriteTargetIds([draft('t2', '内装')], CONFIRMED)).toEqual(['s3'])
  })

  it('重複が無ければ空', () => {
    expect(overwriteTargetIds([draft('t9', '新規')], CONFIRMED)).toEqual([])
  })

  it('同じ ID を二重に返さない', () => {
    expect(
      overwriteTargetIds([draft('t1', '基礎工事'), draft('t1', '基礎工事')], CONFIRMED),
    ).toEqual(['s1', 's2'])
  })
})
