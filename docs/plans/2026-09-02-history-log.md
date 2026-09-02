# 変更履歴機能 実装計画（第 1 期）

設計書: `docs/specs/2026-09-02-history-log-design.md`
ブランチ: `feature/history-log`

**方針:** 失敗するテストを先に書き、実装で通す（R-12）。

## 第 1 期の範囲

履歴の記録・一覧ページ・無限スクロール・並び替え・既存データの移行・表示名の登録。

差分の分割表示と検索は第 2 期、タグと容量監視は第 3 期。

## 全体の制約

- **履歴はファイルから独立させる。** ファイルを消しても履歴は残る
- **全文は保存しない。** 変更箇所だけを持つ
- **保存する変更行に上限を設ける。** 件数は打ち切らず正確な値を持つ
- 履歴の記録に失敗しても、保存・削除そのものは成功させる

---

## Task 1: ドメイン `lib/domain/history.ts`

**Produces:**
- `HistoryAction = 'created' | 'updated' | 'deleted'`
- `ACTION_LABEL` / `KIND_COLOR`（形式ごとの色）
- `MAX_STORED_CHANGES = 300`
- `Change = { type: 'added' | 'removed'; line: number; text: string }`
- `ChangeSet = { changes: Change[]; addedCount: number; removedCount: number; truncated: boolean }`
- `buildChangeSet(oldText, newText): ChangeSet`
- `summarizeChanges(entry): string`（「+3 −1 行」）
- `fileColor(extension): string`

**テスト:**
- 追加だけ / 削除だけ / 置換を正しく数える
- **変更が無ければ空の変更集合**を返す
- 追加行は**変更後の行番号**、削除行は**変更前の行番号**を持つ
- 上限を超えたら `truncated` が立ち、**保存される変更は上限まで**
- **上限を超えても `addedCount` / `removedCount` は正確**（打ち切らない）
- 同じ拡張子は同じ色、違う拡張子は違う色になる
- 拡張子が無くても色を返す

## Task 2: マイグレーション `0010_history_entries.sql`

- `history_entries` テーブル（`file_id` に外部キーを張らない）
- 索引 `(project_id, created_at desc)`、`(project_id, file_id)`
- RLS（自分が所有するプロジェクトのみ）
- `profiles.display_name` を追加

## Task 3: リポジトリ `lib/repositories/history.ts`

- `record(input)` — 1 件記録する
- `listByProject({ projectId, order, limit, before })` — 無限スクロール用に一定件数ずつ
- `countByProject(projectId)`

読み取りは `profiles` を結合し、現在の表示名を優先する。

## Task 4: 記録の組み込み `lib/usecases/record-history.ts`

**Produces:** `recordHistory(repo, input): Promise<void>`

**例外を握りつぶす。** 履歴の記録に失敗して保存や削除が止まるのは本末転倒。

呼び出し箇所:
- `lib/actions/markdown.ts` — 新規作成（`created`）・保存（`updated`）
- `lib/actions/files.ts` — アップロード（`created`）・新版（`updated`）・削除（`deleted`）

**テスト:** 記録が例外を投げても呼び出し元が成功すること

## Task 5: 表示名 `profiles.display_name`

- `lib/domain/profile.ts` に `resolveAuthorName(displayName, email, snapshot)`
- 設定画面に表示名の入力を追加（`lib/actions/settings.ts` を拡張）

**テスト:** 表示名 > 記録時の名前 > メールの @ より前、の優先順位

## Task 6: 履歴ページ `app/(app)/projects/[projectId]/history/page.tsx`

- 既定は新しい順。昇順・降順の切替
- **1 項目 1 行**（色の丸・日付・ファイル名・変更項目・変更者名）
- 収まらない場合は省略可能項目を短縮（CSS の `text-overflow` で 1 行を維持）
- 無限スクロール（`IntersectionObserver` で続きを読む）

**テスト:** 1 行の描画、省略、並び替え、続きの読み込み

## Task 7: 既存データの移行

`file_versions` の既存 5 版から差分を計算し、`history_entries` へ入れる。
移行後、**過去版の全文とバイナリの実体を削除**する（最新版は残す）。

破壊的操作のため、実行前にユーザー確認を取る（R-15）。

## Task 8: ファイル別履歴画面の廃止

`/files/[fileId]/history` を削除し、ファイル画面の「変更履歴」リンクを
履歴ページ（ファイル名で絞り込んだ状態）へのボタンに差し替える。

## Task 9: 検証と worklog

lint / typecheck / test / build と実機確認、`docs/worklog/` に記録。
