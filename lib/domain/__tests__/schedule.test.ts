import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORK_SETTINGS,
  TASK_WEIGHTS,
  WEIGHT_LABEL,
  WEIGHT_OVERLAP_HINT,
  findOverlaps,
  isTaskWeight,
  isWithinWorkHours,
  isWorkDay,
  overlaps,
  validateWorkSettings,
} from '@/lib/domain/schedule'

describe('タスクの重さ', () => {
  it('5 段階を重い順に定義する', () => {
    expect([...TASK_WEIGHTS]).toEqual([
      'very_heavy',
      'heavy',
      'normal',
      'light',
      'very_light',
    ])
  })

  it('すべての段階に日本語表示名がある', () => {
    for (const weight of TASK_WEIGHTS) {
      expect(WEIGHT_LABEL[weight]).toBeTruthy()
    }
    expect(WEIGHT_LABEL.very_heavy).toBe('非常に重い')
    expect(WEIGHT_LABEL.very_light).toBe('非常に軽い')
  })

  it('すべての段階に重複の目安がある', () => {
    for (const weight of TASK_WEIGHTS) {
      expect(WEIGHT_OVERLAP_HINT[weight]).toBeTruthy()
    }
  })

  it('型ガードが正しく判定する', () => {
    expect(isTaskWeight('very_heavy')).toBe(true)
    expect(isTaskWeight('heavy')).toBe(true)
    expect(isTaskWeight('extreme')).toBe(false)
    expect(isTaskWeight('')).toBe(false)
  })
})

describe('overlaps', () => {
  const base = {
    startsAt: '2026-09-01T09:00:00+09:00',
    endsAt: '2026-09-01T11:00:00+09:00',
  }

  it('完全に重なる期間を重複とする', () => {
    expect(overlaps(base, base)).toBe(true)
  })

  it('一部が重なる期間を重複とする', () => {
    expect(
      overlaps(base, {
        startsAt: '2026-09-01T10:00:00+09:00',
        endsAt: '2026-09-01T12:00:00+09:00',
      }),
    ).toBe(true)
  })

  it('内側に含まれる期間を重複とする', () => {
    expect(
      overlaps(base, {
        startsAt: '2026-09-01T09:30:00+09:00',
        endsAt: '2026-09-01T10:00:00+09:00',
      }),
    ).toBe(true)
  })

  it('隣接（終了時刻＝開始時刻）は重複としない', () => {
    expect(
      overlaps(base, {
        startsAt: '2026-09-01T11:00:00+09:00',
        endsAt: '2026-09-01T12:00:00+09:00',
      }),
    ).toBe(false)
  })

  it('離れた期間は重複としない', () => {
    expect(
      overlaps(base, {
        startsAt: '2026-09-02T09:00:00+09:00',
        endsAt: '2026-09-02T11:00:00+09:00',
      }),
    ).toBe(false)
  })

  it('順序を入れ替えても同じ結果になる', () => {
    const other = {
      startsAt: '2026-09-01T10:00:00+09:00',
      endsAt: '2026-09-01T12:00:00+09:00',
    }
    expect(overlaps(base, other)).toBe(overlaps(other, base))
  })

  it('タイムゾーン表記が異なっても同じ時刻なら重複と判定する', () => {
    expect(
      overlaps(base, {
        startsAt: '2026-09-01T01:00:00Z',
        endsAt: '2026-09-01T02:00:00Z',
      }),
    ).toBe(true)
  })

  it('解釈できない日時は重複としない', () => {
    expect(overlaps(base, { startsAt: 'いつか', endsAt: 'そのうち' })).toBe(false)
  })
})

describe('findOverlaps', () => {
  const a = {
    id: 'a',
    startsAt: '2026-09-01T09:00:00+09:00',
    endsAt: '2026-09-01T11:00:00+09:00',
  }
  const b = {
    id: 'b',
    startsAt: '2026-09-01T10:00:00+09:00',
    endsAt: '2026-09-01T12:00:00+09:00',
  }
  const c = {
    id: 'c',
    startsAt: '2026-09-02T09:00:00+09:00',
    endsAt: '2026-09-02T10:00:00+09:00',
  }

  it('重複している相手だけを返す', () => {
    expect(findOverlaps(a, [b, c]).map((x) => x.id)).toEqual(['b'])
  })

  it('自分自身は除外する', () => {
    expect(findOverlaps(a, [a, b]).map((x) => x.id)).toEqual(['b'])
  })

  it('重複がなければ空配列を返す', () => {
    expect(findOverlaps(c, [a, b])).toEqual([])
  })
})

describe('isWorkDay', () => {
  it('既定では月〜金を稼働日とする', () => {
    expect(isWorkDay('2026-09-01T09:00:00+09:00', DEFAULT_WORK_SETTINGS)).toBe(true)
  })

  it('既定では土日を稼働日としない', () => {
    expect(isWorkDay('2026-09-05T09:00:00+09:00', DEFAULT_WORK_SETTINGS)).toBe(false)
    expect(isWorkDay('2026-09-06T09:00:00+09:00', DEFAULT_WORK_SETTINGS)).toBe(false)
  })

  it('稼働曜日を変更すると判定も変わる', () => {
    const weekend = { ...DEFAULT_WORK_SETTINGS, workDays: [0, 6] }
    expect(isWorkDay('2026-09-05T09:00:00+09:00', weekend)).toBe(true)
    expect(isWorkDay('2026-09-01T09:00:00+09:00', weekend)).toBe(false)
  })

  it('解釈できない日時は稼働日としない', () => {
    expect(isWorkDay('いつか', DEFAULT_WORK_SETTINGS)).toBe(false)
  })
})

describe('isWithinWorkHours', () => {
  it('稼働時間帯に収まっていれば true', () => {
    expect(
      isWithinWorkHours(
        { startsAt: '2026-09-01T09:00:00+09:00', endsAt: '2026-09-01T12:00:00+09:00' },
        DEFAULT_WORK_SETTINGS,
      ),
    ).toBe(true)
  })

  it('開始が稼働開始より前なら false', () => {
    expect(
      isWithinWorkHours(
        { startsAt: '2026-09-01T08:00:00+09:00', endsAt: '2026-09-01T10:00:00+09:00' },
        DEFAULT_WORK_SETTINGS,
      ),
    ).toBe(false)
  })

  it('終了が稼働終了を超えたら false', () => {
    expect(
      isWithinWorkHours(
        { startsAt: '2026-09-01T17:00:00+09:00', endsAt: '2026-09-01T19:00:00+09:00' },
        DEFAULT_WORK_SETTINGS,
      ),
    ).toBe(false)
  })

  it('境界ちょうどは範囲内とする', () => {
    expect(
      isWithinWorkHours(
        { startsAt: '2026-09-01T09:00:00+09:00', endsAt: '2026-09-01T18:00:00+09:00' },
        DEFAULT_WORK_SETTINGS,
      ),
    ).toBe(true)
  })

  it('日をまたぐ期間は false', () => {
    expect(
      isWithinWorkHours(
        { startsAt: '2026-09-01T17:00:00+09:00', endsAt: '2026-09-02T10:00:00+09:00' },
        DEFAULT_WORK_SETTINGS,
      ),
    ).toBe(false)
  })

  it('開始と終了が同じなら false', () => {
    expect(
      isWithinWorkHours(
        { startsAt: '2026-09-01T10:00:00+09:00', endsAt: '2026-09-01T10:00:00+09:00' },
        DEFAULT_WORK_SETTINGS,
      ),
    ).toBe(false)
  })
})

describe('validateWorkSettings', () => {
  it('既定値を受け入れる', () => {
    expect(validateWorkSettings(DEFAULT_WORK_SETTINGS).ok).toBe(true)
  })

  it('稼働曜日が空なら拒否する', () => {
    const result = validateWorkSettings({ ...DEFAULT_WORK_SETTINGS, workDays: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('範囲外の曜日を拒否する', () => {
    expect(validateWorkSettings({ ...DEFAULT_WORK_SETTINGS, workDays: [7] }).ok).toBe(false)
    expect(validateWorkSettings({ ...DEFAULT_WORK_SETTINGS, workDays: [-1] }).ok).toBe(false)
  })

  it('開始が終了以降なら拒否する', () => {
    expect(
      validateWorkSettings({
        ...DEFAULT_WORK_SETTINGS,
        workStart: '18:00',
        workEnd: '09:00',
      }).ok,
    ).toBe(false)
  })

  it('時刻の形式が違えば拒否する', () => {
    expect(validateWorkSettings({ ...DEFAULT_WORK_SETTINGS, workStart: '9時' }).ok).toBe(false)
  })

  it('1 日の上限が 0 以下なら拒否する', () => {
    expect(
      validateWorkSettings({ ...DEFAULT_WORK_SETTINGS, dailyCapacityMinutes: 0 }).ok,
    ).toBe(false)
  })

  it('1 日の上限が稼働時間を超えたら拒否する', () => {
    expect(
      validateWorkSettings({ ...DEFAULT_WORK_SETTINGS, dailyCapacityMinutes: 541 }).ok,
    ).toBe(false)
  })

  it('稼働時間ちょうどの上限は受け入れる', () => {
    expect(
      validateWorkSettings({ ...DEFAULT_WORK_SETTINGS, dailyCapacityMinutes: 540 }).ok,
    ).toBe(true)
  })

  it('曜日の重複を取り除いて昇順にする', () => {
    const result = validateWorkSettings({ ...DEFAULT_WORK_SETTINGS, workDays: [3, 1, 3, 2] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.workDays).toEqual([1, 2, 3])
  })
})
