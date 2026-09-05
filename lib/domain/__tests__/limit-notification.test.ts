import { describe, expect, it } from 'vitest'
import { AI_STUDIO_PLAN_URL, jstDateKey, noticeMessage } from '../limit-notification'

describe('jstDateKey', () => {
  it('日本時間の日付を返す', () => {
    // UTC では 9/4 だが、日本時間では 9/5
    expect(jstDateKey(new Date('2026-09-04T15:00:00.000Z'))).toBe('2026-09-05')
  })

  it('日本時間 0 時の直前は前日になる', () => {
    expect(jstDateKey(new Date('2026-09-04T14:59:59.999Z'))).toBe('2026-09-04')
  })

  it('日中も正しく返す', () => {
    expect(jstDateKey(new Date('2026-09-05T03:00:00.000Z'))).toBe('2026-09-05')
  })
})

describe('noticeMessage', () => {
  it('回数の上限だと分かる', () => {
    expect(noticeMessage('calls')).toContain('実行回数')
  })

  it('使用量の上限だと分かる', () => {
    expect(noticeMessage('tokens')).toContain('使用量')
  })
})

describe('AI_STUDIO_PLAN_URL', () => {
  it('Google の正規のドメインを指す', () => {
    // 差し替えの際に、別のドメインへ向けてしまわないように
    expect(new URL(AI_STUDIO_PLAN_URL).origin).toBe('https://aistudio.google.com')
  })
})
