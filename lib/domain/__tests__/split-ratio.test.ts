import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RATIO,
  MAX_RATIO,
  MIN_RATIO,
  clampRatio,
  ratioFromPosition,
  readRatio,
} from '../split-ratio'

describe('clampRatio', () => {
  it('範囲内はそのまま', () => {
    expect(clampRatio(0.6)).toBe(0.6)
  })

  it('小さすぎる値は下限に留める', () => {
    // 端に寄せきると片方が読めなくなる
    expect(clampRatio(0.01)).toBe(MIN_RATIO)
  })

  it('大きすぎる値は上限に留める', () => {
    expect(clampRatio(0.99)).toBe(MAX_RATIO)
  })

  it('数値でなければ既定値に戻す', () => {
    expect(clampRatio(Number.NaN)).toBe(DEFAULT_RATIO)
    expect(clampRatio(Number.POSITIVE_INFINITY)).toBe(DEFAULT_RATIO)
  })
})

describe('readRatio', () => {
  it('記憶した比率を読む', () => {
    expect(readRatio(() => '0.65')).toBe(0.65)
  })

  it('記憶が無ければ既定値', () => {
    expect(readRatio(() => null)).toBe(DEFAULT_RATIO)
  })

  it('壊れた値なら既定値', () => {
    expect(readRatio(() => 'こわれている')).toBe(DEFAULT_RATIO)
  })

  it('範囲外の記憶は上下限に収める', () => {
    expect(readRatio(() => '0.95')).toBe(MAX_RATIO)
  })

  it('保存が使えない環境でも既定値を返す', () => {
    // 私用ウィンドウなどで localStorage が例外を投げても画面は出す
    expect(
      readRatio(() => {
        throw new Error('保存が使えません')
      }),
    ).toBe(DEFAULT_RATIO)
  })
})

describe('ratioFromPosition', () => {
  it('中央なら 0.5', () => {
    expect(ratioFromPosition(500, 0, 1000)).toBe(0.5)
  })

  it('左端からの位置を考慮する', () => {
    expect(ratioFromPosition(600, 100, 1000)).toBe(0.5)
  })

  it('端に寄せても上下限を超えない', () => {
    expect(ratioFromPosition(0, 0, 1000)).toBe(MIN_RATIO)
    expect(ratioFromPosition(1000, 0, 1000)).toBe(MAX_RATIO)
  })

  it('幅が 0 なら既定値', () => {
    expect(ratioFromPosition(100, 0, 0)).toBe(DEFAULT_RATIO)
  })
})
