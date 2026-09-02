import { describe, expect, it } from 'vitest'
import {
  EMPTY_FILTER,
  isEmptyFilter,
  monthToRange,
  parseFilter,
  toSearchParams,
  validateRange,
} from '../history-filter'

describe('isEmptyFilter', () => {
  it('何も指定していなければ空とする', () => {
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true)
  })

  it('ひとつでも指定があれば空ではない', () => {
    expect(isEmptyFilter({ ...EMPTY_FILTER, fileName: '要件' })).toBe(false)
    expect(isEmptyFilter({ ...EMPTY_FILTER, extension: 'md' })).toBe(false)
    expect(isEmptyFilter({ ...EMPTY_FILTER, from: '2026-09-01' })).toBe(false)
  })

  it('空白だけの指定は空として扱う', () => {
    expect(isEmptyFilter({ ...EMPTY_FILTER, fileName: '   ' })).toBe(true)
  })
})

describe('monthToRange', () => {
  it('31 日ある月の末日を正しく求める', () => {
    expect(monthToRange('2026-01')).toEqual({ from: '2026-01-01', to: '2026-01-31' })
  })

  it('30 日の月', () => {
    expect(monthToRange('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('平年の 2 月は 28 日まで', () => {
    expect(monthToRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('うるう年の 2 月は 29 日まで', () => {
    // 月末を 30 日で決め打ちすると 2 月で必ず壊れる
    expect(monthToRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('12 月は年をまたがない', () => {
    expect(monthToRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })

  it('形式が違えば空の範囲を返す', () => {
    expect(monthToRange('2026')).toEqual({ from: '', to: '' })
    expect(monthToRange('')).toEqual({ from: '', to: '' })
    expect(monthToRange('2026-13')).toEqual({ from: '', to: '' })
  })
})

describe('validateRange', () => {
  it('正しい範囲は通す', () => {
    expect(validateRange('2026-09-01', '2026-09-30')).toBeNull()
  })

  it('同じ日でも通す', () => {
    expect(validateRange('2026-09-01', '2026-09-01')).toBeNull()
  })

  it('片方だけの指定も通す', () => {
    expect(validateRange('2026-09-01', '')).toBeNull()
    expect(validateRange('', '2026-09-30')).toBeNull()
  })

  it('開始が終了より後なら拒否する', () => {
    expect(validateRange('2026-09-30', '2026-09-01')).toContain('開始')
  })
})

describe('parseFilter / toSearchParams', () => {
  it('問い合わせから条件を読む', () => {
    const filter = parseFilter(
      new URLSearchParams({
        fileName: '要件',
        extension: 'md',
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    )

    expect(filter).toEqual({
      fileName: '要件',
      extension: 'md',
      from: '2026-09-01',
      to: '2026-09-30',
      tag: '',
    })
  })

  it('指定が無ければ空の条件になる', () => {
    expect(parseFilter(new URLSearchParams())).toEqual(EMPTY_FILTER)
  })

  it('前後の空白を落とす', () => {
    expect(parseFilter(new URLSearchParams({ fileName: '  要件  ' })).fileName).toBe('要件')
  })

  it('拡張子は小文字に揃える', () => {
    // 大文字で入力しても引けるようにする
    expect(parseFilter(new URLSearchParams({ extension: 'MD' })).extension).toBe('md')
  })

  it('往復すると元に戻る', () => {
    const filter = {
      fileName: '要件メモ',
      extension: 'md',
      from: '2026-09-01',
      to: '2026-09-30',
      tag: '設計',
    }

    expect(parseFilter(toSearchParams(filter))).toEqual(filter)
  })

  it('空の項目は問い合わせに含めない', () => {
    const params = toSearchParams({ ...EMPTY_FILTER, fileName: '要件' })

    expect(params.get('fileName')).toBe('要件')
    expect(params.has('extension')).toBe(false)
    expect(params.has('from')).toBe(false)
  })
})

describe('タグの条件', () => {
  it('タグだけの指定でも空ではない', () => {
    expect(isEmptyFilter({ ...EMPTY_FILTER, tag: '設計' })).toBe(false)
  })

  it('問い合わせから読む', () => {
    expect(parseFilter(new URLSearchParams({ tag: '議事録' })).tag).toBe('議事録')
  })

  it('空のタグは問い合わせに含めない', () => {
    expect(toSearchParams({ ...EMPTY_FILTER, fileName: 'a' }).has('tag')).toBe(false)
  })
})
