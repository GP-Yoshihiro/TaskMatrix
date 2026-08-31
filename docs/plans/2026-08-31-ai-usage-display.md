# AI 使用量と所要時間の表示 実装計画

設計書: `docs/specs/2026-08-31-ai-usage-display-design.md`

**方針:** 失敗するテストを先に書き、実装で通す（R-12）。

## 全体の制約

- 記録の失敗が AI 処理の失敗になってはならない
- 取得できない値（残量・埋め込みのトークン数）を推定して表示しない
- `duration_ms` は Server Action の開始〜終了を測る（利用者が待つ時間そのもの）

---

## ブランチ 1: `feature/usage-logging`（記録の土台）

### Task 1: ドメイン `lib/domain/usage.ts`

**Files:** Create `lib/domain/usage.ts`, `lib/domain/__tests__/usage.test.ts`

**Produces:**
- `AI_OPERATIONS` / `AiOperation` / `OPERATION_LABEL` / `DEFAULT_ESTIMATE_MS`
- `AiUsage = { model, inputTokens, outputTokens, inputChars }`
- `median(values: number[]): number`
- `estimateDuration(operation, samples): { ms: number; isMeasured: boolean }`
- `computeProgress(elapsedMs, estimateMs): number | null`
- `formatTokens(n)` / `formatDuration(ms)` / `formatEstimate(ms)`

**テスト:**
- 中央値: 偶数個は中央 2 つの平均
- **90 秒の外れ値 1 件が中央値を動かさないこと**（平均を選ばない根拠）
- 実績 3 件未満は初期値を返し `isMeasured: false`
- 11 件以上あるとき直近 10 件だけ使う
- 進捗は 95% を超えない
- 予測を超えたら `null`（超過を表す）
- `formatDuration(18234)` → `18.2秒` / `65000` → `1分5秒`

### Task 2: マイグレーション `0007_ai_usage.sql`

`ai_usage_logs` テーブル・索引 2 本・RLS（select / insert のみ）。
適用後 `prosecdef` 相当の確認は不要（関数を作らないため）。
**別ユーザーから 0 件であることを SQL で確認する。**

### Task 3: リポジトリ `lib/repositories/ai-usage.ts`

**Produces:** `AiUsageRepository`
- `record(input): Promise<void>`
- `recentDurations(operation, limit): Promise<number[]>` — 成功のみ
- `monthlyTotals(): Promise<{ operation, count, inputTokens, outputTokens }[]>`
- `listRecent(limit): Promise<AiUsageLog[]>`

RLS が効くので `user_id` での絞り込みは挿入時のみ。

### Task 4: 記録ヘルパー `lib/usecases/track-usage.ts`

**Produces:** `trackUsage(repo, context, run)`
- 開始時刻を取り `run()` を実行
- 成功なら `result.data.usage` を、失敗なら 0 と `error_code` を記録
- **`record` が例外を投げても握りつぶし、`run()` の結果をそのまま返す**

**テスト:** 記録が例外を投げても成功結果が返ること（最重要）

### Task 5: Gemini クライアントが usage を返す

- `client.ts` / `plan-schedule-client.ts`: 既存の返り値を `AiUsage` 形に揃える
- `answer-question.ts`: `Result<string>` → `Result<{ text: string; usage: AiUsage }>`
- `embeddings.ts`: `Result<number[][]>` → `Result<{ vectors: number[][]; usage: AiUsage }>`
  （トークンは 0、`inputChars` に送信文字数）

呼び出し側（4 usecase）を追随させる。

### Task 6: Server Action が計測して記録する

`lib/actions/extraction.ts` / `schedules.ts` / `rag.ts` の 4 箇所を `trackUsage` で包む。
戻り値に `usage` と `durationMs` を含める。

---

## ブランチ 2: `feature/usage-display`（画面）

### Task 7: 進捗表示 `components/app/ai-progress.tsx`

`<AiProgress pending estimateMs isMeasured />`
- `useEffect` + `setInterval(100ms)`。**pending が false になったら必ず停止**
- 予測超過時は文言とバーを切り替える

**テスト:** タイマーを進めて表示が更新されること、超過時の文言、停止すること

### Task 8: 使用量表示 `components/app/ai-usage-note.tsx`

`<AiUsageNote usage durationMs />`
- トークンが 0 かつ `inputChars` があるときは文字数表示に切り替える

### Task 9: 3 画面へ組み込み

`task-extract-panel.tsx` / `schedule-planner.tsx` / `rag-chat.tsx`
各ページ（Server Component）で予測を算出して props で渡す。

### Task 10: 履歴ページ `app/(app)/settings/usage/page.tsx`

注記・今月の合計・機能別内訳・直近 50 件。設定ページからリンクする。

### Task 11: 検証と worklog

lint / typecheck / test / build と実機確認、`docs/worklog/` に記録。
