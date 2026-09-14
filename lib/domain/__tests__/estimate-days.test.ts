import { describe, expect, it } from 'vitest'
import {
  ESTIMATE_STEP,
  MAX_ESTIMATED_DAYS,
  formatEstimatedDays,
  inferDaysFromDescription,
  normalizeEstimatedDays,
  parseEstimatedDays,
} from '../estimate-days'

describe('normalizeEstimatedDays', () => {
  it('0.5 日刻みに丸める', () => {
    expect(normalizeEstimatedDays(1.2)).toBe(1)
    expect(normalizeEstimatedDays(1.3)).toBe(1.5)
    expect(normalizeEstimatedDays(2.75)).toBe(3)
  })

  it('0 以下は未設定として null にする', () => {
    // 0 日で終わる作業は無い。入っていれば誤りとみなす
    expect(normalizeEstimatedDays(0)).toBeNull()
    expect(normalizeEstimatedDays(-3)).toBeNull()
  })

  it('最小は 0.5 日', () => {
    expect(normalizeEstimatedDays(0.1)).toBe(0.5)
  })

  it('上限を超えたら上限に止める', () => {
    // 極端な値で日程表が壊れるのを防ぐ
    expect(normalizeEstimatedDays(9999)).toBe(MAX_ESTIMATED_DAYS)
  })

  it('数値でない値は null にする', () => {
    expect(normalizeEstimatedDays(Number.NaN)).toBeNull()
    expect(normalizeEstimatedDays(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('null はそのまま null', () => {
    expect(normalizeEstimatedDays(null)).toBeNull()
  })
})

describe('parseEstimatedDays', () => {
  it('文字から読み取る', () => {
    expect(parseEstimatedDays('2.5')).toBe(2.5)
  })

  it('空欄は未設定', () => {
    expect(parseEstimatedDays('')).toBeNull()
    expect(parseEstimatedDays('   ')).toBeNull()
  })

  it('数値でない文字は未設定', () => {
    expect(parseEstimatedDays('三日')).toBeNull()
  })

  it('読み取った値も丸める', () => {
    expect(parseEstimatedDays('1.2')).toBe(1)
  })
})

describe('formatEstimatedDays', () => {
  it('整数は小数点を出さない', () => {
    expect(formatEstimatedDays(3)).toBe('3 日')
  })

  it('半日は 0.5 として出す', () => {
    expect(formatEstimatedDays(2.5)).toBe('2.5 日')
  })

  it('未設定は「未設定」と出す', () => {
    expect(formatEstimatedDays(null)).toBe('未設定')
  })
})

describe('inferDaysFromDescription', () => {
  it('資料に日数が書かれていれば、それを読み取る', () => {
    expect(inferDaysFromDescription('作業は3日かかる見込み')).toBe(3)
  })

  it('半日の表記も読み取る', () => {
    expect(inferDaysFromDescription('2.5日で完了')).toBe(2.5)
  })

  it('時間の表記は日数に直す', () => {
    // 稼働 8 時間を 1 日とする
    expect(inferDaysFromDescription('8時間程度')).toBe(1)
    expect(inferDaysFromDescription('4時間で終わる')).toBe(0.5)
  })

  it('週の表記は日数に直す', () => {
    // 稼働 5 日を 1 週とする
    expect(inferDaysFromDescription('2週間かかる')).toBe(10)
  })

  it('数値が無ければ null を返す', () => {
    // ここで勝手に決めない。推定は AI に任せる
    expect(inferDaysFromDescription('資料をまとめる')).toBeNull()
  })

  it('日付のような数値を期間と取り違えない', () => {
    // 「9月14日まで」は期限であって、所要日数ではない
    expect(inferDaysFromDescription('9月14日までに提出')).toBeNull()
  })

  it('空文字なら null', () => {
    expect(inferDaysFromDescription('')).toBeNull()
  })
})

describe('刻みと上限', () => {
  it('合意した値', () => {
    expect(ESTIMATE_STEP).toBe(0.5)
    expect(MAX_ESTIMATED_DAYS).toBe(365)
  })
})
