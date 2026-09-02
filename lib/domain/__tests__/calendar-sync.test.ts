import { describe, expect, it } from 'vitest'
import { diffSchedule, toGoogleEvent } from '../calendar-sync'

const local = {
  startsAt: '2026-09-03T00:00:00+00:00',
  endsAt: '2026-09-03T01:00:00+00:00',
}

describe('toGoogleEvent', () => {
  it('タスク名を予定名にし、算出理由を説明に入れる', () => {
    const event = toGoogleEvent({
      taskTitle: '設計レビューを実施する',
      reason: '期限が近く、負荷も重いため午前に確保',
      startsAt: local.startsAt,
      endsAt: local.endsAt,
    })

    expect(event.summary).toBe('設計レビューを実施する')
    expect(event.description).toContain('期限が近く')
    expect(event.start.dateTime).toBe(local.startsAt)
    expect(event.end.dateTime).toBe(local.endsAt)
  })

  it('算出理由が無くても説明を壊さない', () => {
    const event = toGoogleEvent({
      taskTitle: 'タスク',
      reason: '',
      startsAt: local.startsAt,
      endsAt: local.endsAt,
    })

    expect(typeof event.description).toBe('string')
  })
})

describe('diffSchedule', () => {
  it('日時が同じなら変更なし', () => {
    expect(
      diffSchedule(local, { status: 'confirmed', start: local.startsAt, end: local.endsAt }),
    ).toMatchObject({ changed: false })
  })

  it('表記が違っても同じ時刻なら変更なし', () => {
    // Google は +09:00 で返し、こちらは Z で持っていることがある。
    // 文字列比較のままだと、毎回「変わった」と誤判定してしまう
    const result = diffSchedule(
      { startsAt: '2026-09-03T00:00:00Z', endsAt: '2026-09-03T01:00:00Z' },
      {
        status: 'confirmed',
        start: '2026-09-03T09:00:00+09:00',
        end: '2026-09-03T10:00:00+09:00',
      },
    )

    expect(result.changed).toBe(false)
  })

  it('開始時刻が変わったら検出する', () => {
    // 終了より前に収まる範囲で動かす（終了は 01:00 のまま）
    const result = diffSchedule(local, {
      status: 'confirmed',
      start: '2026-09-02T23:00:00+00:00',
      end: local.endsAt,
    })

    expect(result.changed).toBe(true)
    expect(result.startsAt).toBe('2026-09-02T23:00:00+00:00')
    expect(result.endsAt).toBe(local.endsAt)
  })

  it('終了時刻が変わったら検出する', () => {
    const result = diffSchedule(local, {
      status: 'confirmed',
      start: local.startsAt,
      end: '2026-09-03T03:00:00+00:00',
    })

    expect(result.changed).toBe(true)
    expect(result.endsAt).toBe('2026-09-03T03:00:00+00:00')
  })

  it('Google 側で削除されていても取り込まない', () => {
    // 削除を持ち込むと「タスクはあるのに予定だけ消えた」状態を作ってしまう
    const result = diffSchedule(local, {
      status: 'cancelled',
      start: '2026-09-09T00:00:00+00:00',
      end: '2026-09-09T01:00:00+00:00',
    })

    expect(result.changed).toBe(false)
  })

  it('日時が欠けていたら取り込まない', () => {
    // 終日予定に変えられた場合など。壊れた値で上書きしない
    expect(
      diffSchedule(local, { status: 'confirmed', start: null, end: null }).changed,
    ).toBe(false)
  })

  it('解釈できない日時は取り込まない', () => {
    expect(
      diffSchedule(local, { status: 'confirmed', start: 'あした', end: 'あさって' }).changed,
    ).toBe(false)
  })

  it('終了が開始より前なら取り込まない', () => {
    // schedules には ends_at > starts_at の制約がある。壊れた値を入れない
    const result = diffSchedule(local, {
      status: 'confirmed',
      start: '2026-09-03T05:00:00+00:00',
      end: '2026-09-03T04:00:00+00:00',
    })

    expect(result.changed).toBe(false)
  })
})
