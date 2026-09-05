import { describe, expect, it } from 'vitest'
import { SLOW_MS, STALLED_MS, loadingNotice } from '../loading-notice'

describe('loadingNotice', () => {
  it('はじめは何も出さない', () => {
    // 一瞬で終わる遷移に文字が点滅すると、かえって遅く感じる
    expect(loadingNotice(0)).toBeNull()
    expect(loadingNotice(SLOW_MS - 1)).toBeNull()
  })

  it('しばらく待たされたら、読み込み中だと伝える', () => {
    expect(loadingNotice(SLOW_MS)).toContain('読み込んでいます')
  })

  it('さらに待たされたら、通信を疑うよう伝える', () => {
    // 「読み込んでいます」のままだと、待てば終わるのか判断できない
    expect(loadingNotice(STALLED_MS)).toContain('通信')
  })

  it('段階は後戻りしない', () => {
    expect(loadingNotice(STALLED_MS + 60_000)).toBe(loadingNotice(STALLED_MS))
  })

  it('しきい値は、速い回線で出ない程度に離す', () => {
    expect(SLOW_MS).toBeGreaterThanOrEqual(2_000)
    expect(STALLED_MS).toBeGreaterThan(SLOW_MS)
  })
})
