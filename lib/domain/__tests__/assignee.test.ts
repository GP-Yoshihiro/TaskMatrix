import { describe, expect, it } from 'vitest'
import { NO_ASSIGNEE, hasAssignee, resolveAssignee } from '../assignee'

describe('resolveAssignee', () => {
  it('メンバーが選ばれていれば、その名前を使う', () => {
    expect(resolveAssignee({ memberName: '田中', freeText: '' })).toBe('田中')
  })

  it('メンバーが無ければ、自由入力の文字を使う', () => {
    // 名簿に無い人も、今までどおり扱えるようにする
    expect(resolveAssignee({ memberName: null, freeText: '外注 山本' })).toBe('外注 山本')
  })

  it('両方あるときはメンバーを優先する', () => {
    // 名簿のほうが表記が揃っており、並べ替えの基準にできる
    expect(resolveAssignee({ memberName: '田中', freeText: 'たなか' })).toBe('田中')
  })

  it('どちらも無ければ未設定とする', () => {
    expect(resolveAssignee({ memberName: null, freeText: '' })).toBe(NO_ASSIGNEE)
  })

  it('空白だけの自由入力は未設定とする', () => {
    expect(resolveAssignee({ memberName: null, freeText: '   ' })).toBe(NO_ASSIGNEE)
  })

  it('自由入力の前後の空白は落とす', () => {
    expect(resolveAssignee({ memberName: null, freeText: '  山本 ' })).toBe('山本')
  })

  it('メンバー名が空文字なら、自由入力に落とす', () => {
    // 消されたメンバーを参照していた場合に、空の見出しを作らない
    expect(resolveAssignee({ memberName: '', freeText: '山本' })).toBe('山本')
  })
})

describe('hasAssignee', () => {
  it('担当が決まっていれば真', () => {
    expect(hasAssignee({ memberName: '田中', freeText: '' })).toBe(true)
    expect(hasAssignee({ memberName: null, freeText: '山本' })).toBe(true)
  })

  it('決まっていなければ偽', () => {
    expect(hasAssignee({ memberName: null, freeText: '' })).toBe(false)
  })
})
