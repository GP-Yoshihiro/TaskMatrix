/**
 * AI の使用量と所要時間。
 *
 * 「残りトークン量」は扱わない。Google がその値を公開していないため。
 * 2026-08-31 の実測では、モデル情報が返すのは 1 リクエストの上限
 * (inputTokenLimit / outputTokenLimit) だけで、残高に相当する項目は無い。
 * 取得できない値を推定して出すと「あと 99 万トークン使える」と誤解されるので、
 * 画面には実際に使った量だけを出し、残量を出せない理由を明記する。
 */

export const AI_OPERATIONS = [
  'extract_tasks',
  'plan_schedule',
  'answer_question',
  'build_index',
] as const

export type AiOperation = (typeof AI_OPERATIONS)[number]

export const OPERATION_LABEL: Record<AiOperation, string> = {
  extract_tasks: 'タスク抽出',
  plan_schedule: '予定の算出',
  answer_question: 'チャットの回答',
  build_index: '検索用データの作成',
}

/** 実測にもとづく初期値。実績が溜まるまでの目安として使う */
export const DEFAULT_ESTIMATE_MS: Record<AiOperation, number> = {
  extract_tasks: 25_000,
  plan_schedule: 20_000,
  answer_question: 20_000,
  build_index: 5_000,
}

/** 中央値を信用しはじめる件数 */
export const MIN_SAMPLES = 3

/** 予測に使う実績の件数 */
export const ESTIMATE_SAMPLE_SIZE = 10

/**
 * 進捗バーの上限。
 * 完了前に 100% にすると「終わったのに固まっている」と誤解されるため、
 * 実際に終わるまでは満たさない。
 */
export const PROGRESS_CAP = 0.95

export type AiUsage = {
  /** 実際に応答したモデル。フォールバック後の値を入れる */
  model: string
  inputTokens: number
  outputTokens: number
  /** 送った文字数。埋め込みはトークン数を返さないため、その代替指標 */
  inputChars: number
}

export const EMPTY_USAGE: AiUsage = {
  model: '',
  inputTokens: 0,
  outputTokens: 0,
  inputChars: 0,
}

export type Estimate = {
  ms: number
  /** 実績にもとづく値か。false なら初期値なので「目安」と示す */
  isMeasured: boolean
}

export function median(values: number[]): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * 予測時間を求める。
 *
 * 平均ではなく中央値を使う。90 秒で打ち切られた 1 件が混ざると平均は大きく歪むが、
 * 中央値ならその 1 件に引きずられない。
 *
 * @param samples 過去の所要時間。**新しい順**で渡す
 */
export function estimateDuration(operation: AiOperation, samples: number[]): Estimate {
  const valid = samples.filter((value) => Number.isFinite(value) && value > 0)

  if (valid.length < MIN_SAMPLES) {
    return { ms: DEFAULT_ESTIMATE_MS[operation], isMeasured: false }
  }

  return { ms: median(valid.slice(0, ESTIMATE_SAMPLE_SIZE)), isMeasured: true }
}

/**
 * 進捗の割合。予測を超えたら null を返し、呼び出し側で不確定として扱わせる。
 */
export function computeProgress(elapsedMs: number, estimateMs: number): number | null {
  if (!(estimateMs > 0)) return null
  if (elapsedMs >= estimateMs) return null

  return Math.min(elapsedMs / estimateMs, PROGRESS_CAP)
}

export function formatTokens(count: number): string {
  return count.toLocaleString('ja-JP')
}

export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}秒`

  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)

  return `${minutes}分${seconds}秒`
}

export function formatEstimate(ms: number): string {
  if (ms < 60_000) return `約${Math.round(ms / 1000)}秒`

  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)

  return `約${minutes}分${seconds}秒`
}

/**
 * 処理直後に出す 1 行。
 * 埋め込みはトークン数を返さないので、文字数に切り替えたうえで理由を添える。
 */
export function summarizeUsage(usage: AiUsage, durationMs: number): string {
  const tail = `${formatDuration(durationMs)}・${usage.model}`

  if (usage.inputTokens === 0 && usage.outputTokens === 0) {
    return `入力 ${formatTokens(usage.inputChars)}文字・${tail}（埋め込みはトークン数を返しません）`
  }

  return `入力 ${formatTokens(usage.inputTokens)} ／ 出力 ${formatTokens(usage.outputTokens)} トークン・${tail}`
}

/**
 * 今月の起点（日本時間の 1 日 0 時）を ISO 文字列で返す。
 *
 * サーバーの時刻が UTC でも日本時間の月替わりで区切る。
 * UTC で区切ると、日本時間の月初 9 時間分が前月に混ざる。
 */
export function monthStartIso(now: Date): string {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000
  const jst = new Date(now.getTime() + JST_OFFSET_MS)

  return new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - JST_OFFSET_MS,
  ).toISOString()
}

export type UsageTotal = {
  operation: AiOperation
  count: number
  inputTokens: number
  outputTokens: number
}

type UsageRow = {
  operation: AiOperation
  inputTokens: number
  outputTokens: number
}

/**
 * 機能ごとの内訳。使用量の多い順に並べ、どの機能が費用を食っているか分かるようにする。
 */
export function aggregateByOperation(logs: UsageRow[]): UsageTotal[] {
  const totals = new Map<AiOperation, UsageTotal>()

  for (const log of logs) {
    const current = totals.get(log.operation) ?? {
      operation: log.operation,
      count: 0,
      inputTokens: 0,
      outputTokens: 0,
    }

    current.count += 1
    current.inputTokens += log.inputTokens
    current.outputTokens += log.outputTokens
    totals.set(log.operation, current)
  }

  return [...totals.values()].sort(
    (a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
  )
}

export function sumUsage(logs: UsageRow[]): Omit<UsageTotal, 'operation'> {
  return logs.reduce(
    (total, log) => ({
      count: total.count + 1,
      inputTokens: total.inputTokens + log.inputTokens,
      outputTokens: total.outputTokens + log.outputTokens,
    }),
    { count: 0, inputTokens: 0, outputTokens: 0 },
  )
}

/**
 * AI を呼ぶ Server Action の戻り値。
 * 画面が使用量と所要時間を表示できるよう、必ずこれらを添えて返す。
 */
export type WithUsage<T> = T & { usage: AiUsage; durationMs: number }
