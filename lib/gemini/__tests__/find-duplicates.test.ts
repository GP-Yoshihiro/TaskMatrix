import { describe, expect, it } from 'vitest'
import {
  DUPLICATE_SCHEMA,
  buildDuplicatePrompt,
  parseDuplicateResponse,
} from '../find-duplicates'

const CANDIDATES = [
  { key: 'a', title: '見積もりを提出する', description: '' },
  { key: 'b', title: '見積書を先方へ送付', description: '' },
]

describe('buildDuplicatePrompt', () => {
  it('判定の対象を並べる', () => {
    const prompt = buildDuplicatePrompt(CANDIDATES)
    expect(prompt).toContain('見積もりを提出する')
    expect(prompt).toContain('key: a')
  })

  it('迷ったらまとめないよう指示する', () => {
    // まとめすぎると、別の作業が消える
    expect(buildDuplicatePrompt(CANDIDATES)).toContain('迷った場合は**組にしないでください。**')
  })

  it('似ているだけの例を示す', () => {
    // 「作成」と「確認」を同じにされると困る
    expect(buildDuplicatePrompt(CANDIDATES)).toContain('議事録を確認する')
  })

  it('本文は渡さない', () => {
    // 判定に要らない。送る情報は目的に必要な最小限にする
    expect(buildDuplicatePrompt(CANDIDATES)).not.toContain('本文')
  })
})

describe('parseDuplicateResponse', () => {
  it('組分けを取り出す', () => {
    const result = parseDuplicateResponse({ groups: [['a', 'b']] })
    if (!result.ok) throw new Error('解釈できていない')
    expect(result.data).toEqual([['a', 'b']])
  })

  it('1 件だけの組は落とす', () => {
    const result = parseDuplicateResponse({ groups: [['a'], ['b', 'c']] })
    if (!result.ok) throw new Error('解釈できていない')
    expect(result.data).toEqual([['b', 'c']])
  })

  it('組が無ければ空を返す', () => {
    const result = parseDuplicateResponse({ groups: [] })
    if (!result.ok) throw new Error('解釈できていない')
    expect(result.data).toEqual([])
  })

  it('形が違えば失敗として返す', () => {
    // 壊れた応答で、意図しないまとめ方をしない
    expect(parseDuplicateResponse({ groups: 'まとめ' }).ok).toBe(false)
    expect(parseDuplicateResponse(null).ok).toBe(false)
  })
})

describe('DUPLICATE_SCHEMA', () => {
  it('組の一覧を必須にする', () => {
    expect(DUPLICATE_SCHEMA.required).toContain('groups')
  })
})
