import { describe, expect, it } from 'vitest'
import {
  CAPACITY_LIMIT_BYTES,
  CAPACITY_THRESHOLD,
  formatUsage,
  needsPurge,
} from '../capacity'

const threshold = CAPACITY_LIMIT_BYTES * CAPACITY_THRESHOLD

describe('needsPurge', () => {
  it('余裕があれば消さない', () => {
    expect(needsPurge(12 * 1024 * 1024)).toBe(false)
  })

  it('閾値ちょうどでは消さない', () => {
    // 「超えたとき」だけ消す。境目で毎回動くと落ち着かない
    expect(needsPurge(threshold)).toBe(false)
  })

  it('閾値を超えたら消す', () => {
    expect(needsPurge(threshold + 1)).toBe(true)
  })

  it('上限を超えていれば当然消す', () => {
    expect(needsPurge(CAPACITY_LIMIT_BYTES)).toBe(true)
  })

  it('上限ちょうどまで待たない', () => {
    // 書き込めなくなってから気付くのでは遅い
    expect(threshold).toBeLessThan(CAPACITY_LIMIT_BYTES)
  })
})

describe('formatUsage', () => {
  it('使用量と上限と割合を示す', () => {
    expect(formatUsage(12 * 1024 * 1024)).toBe('12 MB / 500 MB（2%）')
  })

  it('小さい値は KB で示す', () => {
    expect(formatUsage(2048)).toContain('2 KB')
  })

  it('とても小さい値はバイトで示す', () => {
    expect(formatUsage(500)).toContain('500 B')
  })

  it('割合を四捨五入する', () => {
    expect(formatUsage(CAPACITY_LIMIT_BYTES / 2)).toContain('50%')
  })

  it('上限に達していれば 100%', () => {
    expect(formatUsage(CAPACITY_LIMIT_BYTES)).toContain('100%')
  })
})
