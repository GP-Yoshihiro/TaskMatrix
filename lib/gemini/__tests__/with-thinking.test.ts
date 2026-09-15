import { describe, expect, it, vi } from 'vitest'
import { withThinkingLevel } from '../with-thinking'

const PARAMS = { model: 'm', input: [] }

describe('withThinkingLevel', () => {
  it('思考の深さを添えて呼ぶ', async () => {
    const create = vi.fn().mockResolvedValue('ok')

    await withThinkingLevel(create, PARAMS, 'low')

    expect(create).toHaveBeenCalledWith({
      ...PARAMS,
      generation_config: { thinking_level: 'low' },
    })
  })

  it('指定が拒まれたら、指定なしでもう一度呼ぶ', async () => {
    // モデルが思考の指定に対応していない場合に、機能ごと止めない。
    // 上限に達していて実地で確かめられない間の、安全策
    const create = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Invalid argument'), { status: 400 }))
      .mockResolvedValue('ok')

    await expect(withThinkingLevel(create, PARAMS, 'low')).resolves.toBe('ok')

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1][0]).toEqual(PARAMS)
  })

  it('混雑や上限は、そのまま投げ直す', async () => {
    // 指定の問題ではないので、指定を外して試しても意味がない
    const create = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('quota'), { status: 429 }))

    await expect(withThinkingLevel(create, PARAMS, 'low')).rejects.toThrow('quota')
    expect(create).toHaveBeenCalledOnce()
  })

  it('障害も、そのまま投げ直す', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('boom'), { status: 503 }))

    await expect(withThinkingLevel(create, PARAMS, 'low')).rejects.toThrow('boom')
    expect(create).toHaveBeenCalledOnce()
  })

  it('指定なしでも失敗したら、その誤りを投げる', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Invalid argument'), { status: 400 }))
      .mockRejectedValue(new Error('二度目の誤り'))

    await expect(withThinkingLevel(create, PARAMS, 'low')).rejects.toThrow('二度目の誤り')
  })
})
