import { describe, expect, it } from 'vitest'
import { readCollapsed } from '../sidebar-state'

describe('readCollapsed', () => {
  it('閉じた状態を記憶していれば閉じる', () => {
    expect(readCollapsed(() => 'true')).toBe(true)
  })

  it('開いた状態を記憶していれば開く', () => {
    expect(readCollapsed(() => 'false')).toBe(false)
  })

  it('記憶が無ければ開いておく', () => {
    // 初めての利用者に移動先が見えている方がよい
    expect(readCollapsed(() => null)).toBe(false)
  })

  it('壊れた値なら開いておく', () => {
    expect(readCollapsed(() => 'こわれている')).toBe(false)
  })

  it('保存が使えない環境でも開いておく', () => {
    expect(
      readCollapsed(() => {
        throw new Error('保存が使えません')
      }),
    ).toBe(false)
  })
})
