# iOS ショートカット / Webhook API 実装計画

設計書: `docs/specs/2026-09-01-shortcuts-api-design.md`
ブランチ: `feature/api-tokens`

**方針:** 失敗するテストを先に書き、実装で通す（R-12）。

## 全体の制約

- **リクエスト本文から `projectId` を受け取らない。** 操作範囲はトークンが決める
- トークンの平文を保存しない・ログに出さない・応答に含めない（発行直後の 1 回を除く）
- 認証失敗の理由を書き分けない（すべて 401）
- サーバー専用キーが無ければ 503 を返し、黙って失敗させない

---

## Task 1: ドメイン `lib/domain/api-token.ts`

**Produces:**
- `TOKEN_PREFIX = 'tmx_'`, `RATE_LIMIT_PER_MINUTE = 60`, `RATE_WINDOW_MS = 60_000`
- `buildToken(bytes: Uint8Array): string`
- `hashToken(token: string): string`（SHA-256 hex）
- `displayPrefix(token: string): string`
- `parseBearer(header: string | null): string | null`
- `nextRateState(current, now): { windowStartedAt, count, allowed, retryAfterSeconds }`

**テスト:**
- 生成したトークンは `tmx_` で始まり、同じ入力から同じハッシュが出る
- **異なるトークンから異なるハッシュが出る**
- **ハッシュから平文が復元できない**（ハッシュに平文が含まれない）
- `parseBearer` は `Bearer ` 以外の形式・空・欠落で null
- 制限内なら通し、超えたら止める。**窓が切れたら数え直す**
- `retryAfterSeconds` は窓の残り秒

## Task 2: ドメイン `lib/domain/today.ts`

**Produces:** `selectTodayTasks({ tasks, schedules, today }): TodayTask[]`

**テスト:**
- 期限が今日以前のものを含む（**超過分も含む**）
- 今日の予定があるものを含む（**期限が先でも**）
- 完了済みを除く
- 重複させない（期限も予定も今日のタスクが 2 回出ない）
- 予定があるものを開始時刻順に先へ出す
- 予定が無いものは期限の近い順、同じなら優先度順
- 明日の予定・明日の期限は含めない

## Task 3: マイグレーション `0008_api_tokens.sql`

`api_tokens` テーブル・`token_hash` の unique 索引・RLS（自分のプロジェクトのみ）。
適用後、別ユーザーから 0 件になることを SQL で確認する。

## Task 4: リポジトリ `lib/repositories/api-tokens.ts`

- `create(input)` / `listByProject(projectId)` / `deleteById(id)`
- `findByHash(hash)`（サーバー専用キー用。project_id・user_id・失効状態・回数制限の状態を返す）
- `touch(id, { lastUsedAt, windowStartedAt, count })`

## Task 5: サーバー専用クライアント `lib/supabase/service.ts`

`SUPABASE_SERVICE_ROLE_KEY` が無ければ null を返す。
**例外を投げず、呼び出し側が 503 を返せるようにする。**

## Task 6: 認証ユースケース `lib/usecases/authenticate-token.ts`

**Produces:** `authenticateToken(repo, header, now): Result<{ tokenId, projectId, userId }>`

- ヘッダーを解析 → ハッシュ化 → 照合 → 回数制限 → `last_used_at` 更新
- **失敗はすべて同じエラーコード**（存在しない／形式違いを区別しない）
- 回数超過だけは別コードにし、429 を返せるようにする

**テスト:** 未知のトークンと形式違いで**同じ結果**になること（最重要）

## Task 7: Route Handler `app/api/v1/tasks/route.ts`（POST）

`title` 必須。`projectId` は**トークンから取る**。
`Cache-Control: no-store`。

## Task 8: Route Handler `app/api/v1/tasks/today/route.ts`（GET）

`selectTodayTasks` の結果と読み上げ用の `summary` を返す。

## Task 9: Server Action `lib/actions/api-tokens.ts`

発行・失効。発行時のみ平文を返す。

## Task 10: 画面 `components/app/api-token-panel.tsx`

発行フォーム・一覧・失効ダイアログ・発行直後の全文表示・貼り付け用 URL。
プロジェクト画面へ組み込む。

## Task 11: 検証と worklog

lint / typecheck / test / build、`curl` による実動作確認、`docs/worklog/` に記録。
