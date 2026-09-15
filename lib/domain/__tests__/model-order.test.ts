import { describe, expect, it } from 'vitest'
import { FAST_MODEL, SLOW_MODEL, resolveModelOrder } from '../model-order'

describe('resolveModelOrder', () => {
  it('指定が無ければ、速いモデルを先に試す', () => {
    expect(resolveModelOrder(undefined, undefined)).toEqual([FAST_MODEL, SLOW_MODEL])
  })

  it('指定があれば、その順を尊重する', () => {
    expect(resolveModelOrder('model-a', 'model-b')).toEqual(['model-a', 'model-b', FAST_MODEL])
  })

  it('同じモデルを 2 つ指定しても、速いモデルが必ず残る', () => {
    // ここが抜けていた。環境変数で遅いモデルを両方に指定すると
    // 重複が取り除かれ、**候補が 1 つだけ**になり、予備が働かなかった
    expect(resolveModelOrder(SLOW_MODEL, SLOW_MODEL)).toEqual([SLOW_MODEL, FAST_MODEL])
  })

  it('遅いモデルだけを指定しても、速いモデルを後ろに足す', () => {
    expect(resolveModelOrder(SLOW_MODEL, undefined)).toEqual([SLOW_MODEL, FAST_MODEL])
  })

  it('速いモデルを指定していれば、足さない', () => {
    expect(resolveModelOrder(FAST_MODEL, 'model-b')).toEqual([FAST_MODEL, 'model-b'])
  })

  it('空文字は指定が無いものとして扱う', () => {
    expect(resolveModelOrder('', '  ')).toEqual([FAST_MODEL, SLOW_MODEL])
  })

  it('候補は必ず 1 つ以上ある', () => {
    expect(resolveModelOrder(undefined, undefined).length).toBeGreaterThan(0)
  })
})
