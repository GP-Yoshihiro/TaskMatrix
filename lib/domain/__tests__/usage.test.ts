import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ESTIMATE_MS,
  PROGRESS_CAP,
  computeProgress,
  estimateDuration,
  formatDuration,
  formatEstimate,
  formatTokens,
  median,
  aggregateByOperation,
  monthStartIso,
  sumUsage,
  summarizeUsage,
} from '../usage'

describe('median', () => {
  it('奇数個は中央の値を返す', () => {
    expect(median([30, 10, 20])).toBe(20)
  })

  it('偶数個は中央 2 つの平均を返す', () => {
    expect(median([10, 20, 30, 40])).toBe(25)
  })

  it('空なら 0 を返す', () => {
    expect(median([])).toBe(0)
  })

  it('元の配列を並べ替えない', () => {
    const values = [30, 10, 20]
    median(values)
    expect(values).toEqual([30, 10, 20])
  })
})

describe('estimateDuration', () => {
  it('実績が 3 件未満なら初期値を返し、実測ではないと示す', () => {
    expect(estimateDuration('answer_question', [18_000, 19_000])).toEqual({
      ms: DEFAULT_ESTIMATE_MS.answer_question,
      isMeasured: false,
    })
  })

  it('実績が 3 件以上あれば中央値を返す', () => {
    expect(estimateDuration('answer_question', [18_000, 20_000, 22_000])).toEqual({
      ms: 20_000,
      isMeasured: true,
    })
  })

  it('タイムアウトした 1 件に引きずられない（平均ではなく中央値を使う理由）', () => {
    // 90 秒の外れ値が 1 件。平均は 33.6 秒になるが、中央値は 20 秒のまま
    const samples = [19_000, 20_000, 21_000, 18_000, 90_000]
    const average = samples.reduce((a, b) => a + b, 0) / samples.length

    expect(estimateDuration('answer_question', samples).ms).toBe(20_000)
    expect(average).toBeGreaterThan(30_000)
  })

  it('直近 10 件だけを使う（配列は新しい順で渡される）', () => {
    // 先頭 10 件はすべて 5 秒。以降の古い 100 秒は無視されること
    const samples = [...Array(10).fill(5_000), ...Array(10).fill(100_000)]
    expect(estimateDuration('extract_tasks', samples).ms).toBe(5_000)
  })

  it('0 や負の値は実績として数えない', () => {
    expect(estimateDuration('build_index', [0, -1, 4_000]).isMeasured).toBe(false)
  })
})

describe('computeProgress', () => {
  it('経過が予測の半分なら 0.5 を返す', () => {
    expect(computeProgress(10_000, 20_000)).toBeCloseTo(0.5)
  })

  it('完了前に 100% にしない', () => {
    // 「終わったのに固まっている」という誤解を防ぐため 95% で止める
    expect(computeProgress(19_999, 20_000)).toBe(PROGRESS_CAP)
    expect(PROGRESS_CAP).toBeLessThan(1)
  })

  it('予測を超えたら null を返す（不確定を表す）', () => {
    expect(computeProgress(32_000, 20_000)).toBeNull()
  })

  it('予測が 0 なら null を返す', () => {
    expect(computeProgress(1_000, 0)).toBeNull()
  })
})

describe('formatDuration', () => {
  it('1 分未満は小数第 1 位までの秒で表す', () => {
    expect(formatDuration(18_234)).toBe('18.2秒')
  })

  it('1 分以上は分と秒で表す', () => {
    expect(formatDuration(65_000)).toBe('1分5秒')
  })

  it('ちょうど 1 分', () => {
    expect(formatDuration(60_000)).toBe('1分0秒')
  })
})

describe('formatEstimate', () => {
  it('秒に丸めて約を付ける', () => {
    expect(formatEstimate(20_400)).toBe('約20秒')
  })

  it('1 分以上', () => {
    expect(formatEstimate(65_000)).toBe('約1分5秒')
  })
})

describe('formatTokens', () => {
  it('3 桁ごとに区切る', () => {
    expect(formatTokens(3200)).toBe('3,200')
  })
})

describe('summarizeUsage', () => {
  it('トークンが取れていれば入力と出力を並べる', () => {
    expect(
      summarizeUsage(
        { model: 'gemini-3.5-flash', inputTokens: 3200, outputTokens: 850, inputChars: 12_000 },
        18_234,
      ),
    ).toBe('入力 3,200 ／ 出力 850 トークン・18.2秒・gemini-3.5-flash')
  })

  it('トークンが取れない埋め込みは文字数で表し、理由を添える', () => {
    expect(
      summarizeUsage(
        { model: 'gemini-embedding-2', inputTokens: 0, outputTokens: 0, inputChars: 12_400 },
        4_100,
      ),
    ).toBe(
      '入力 12,400文字・4.1秒・gemini-embedding-2（埋め込みはトークン数を返しません）',
    )
  })
})

describe('monthStartIso', () => {
  it('日本時間の月初 0 時を返す', () => {
    // 2026-09-05 12:00 JST = 2026-09-05T03:00:00Z
    expect(monthStartIso(new Date('2026-09-05T03:00:00Z'))).toBe('2026-08-31T15:00:00.000Z')
  })

  it('UTC ではまだ前月でも、日本時間で月が変わっていれば新しい月で区切る', () => {
    // 2026-08-31 23:30 UTC = 2026-09-01 08:30 JST → 9 月として扱う
    expect(monthStartIso(new Date('2026-08-31T23:30:00Z'))).toBe('2026-08-31T15:00:00.000Z')
  })

  it('日本時間で月初の直前は前月で区切る', () => {
    // 2026-08-31 14:59 UTC = 2026-08-31 23:59 JST → 8 月
    expect(monthStartIso(new Date('2026-08-31T14:59:00Z'))).toBe('2026-07-31T15:00:00.000Z')
  })
})

describe('aggregateByOperation', () => {
  const logs = [
    { operation: 'answer_question' as const, inputTokens: 100, outputTokens: 50 },
    { operation: 'extract_tasks' as const, inputTokens: 3000, outputTokens: 900 },
    { operation: 'answer_question' as const, inputTokens: 200, outputTokens: 60 },
  ]

  it('機能ごとに件数とトークンを合計する', () => {
    const result = aggregateByOperation(logs)
    const chat = result.find((row) => row.operation === 'answer_question')

    expect(chat).toEqual({
      operation: 'answer_question',
      count: 2,
      inputTokens: 300,
      outputTokens: 110,
    })
  })

  it('使用量の多い順に並べる', () => {
    expect(aggregateByOperation(logs)[0].operation).toBe('extract_tasks')
  })

  it('空なら空を返す', () => {
    expect(aggregateByOperation([])).toEqual([])
  })
})

describe('sumUsage', () => {
  it('全体の合計を出す', () => {
    expect(
      sumUsage([
        { operation: 'answer_question', inputTokens: 100, outputTokens: 50 },
        { operation: 'extract_tasks', inputTokens: 300, outputTokens: 20 },
      ]),
    ).toEqual({ count: 2, inputTokens: 400, outputTokens: 70 })
  })
})
