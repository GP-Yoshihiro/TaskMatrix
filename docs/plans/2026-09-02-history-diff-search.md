# 変更履歴機能 実装計画（第 2 期）

設計書: `docs/specs/2026-09-02-history-log-design.md`
ブランチ: `feature/history-diff-search`

**方針:** 失敗するテストを先に書き、実装で通す（R-12）。

## 第 2 期の範囲

- 「編集」をクリックして**画面右側に差分を表示**（ページは切り替えない）
- 境界を**ドラッグして比率を変更**し、その比率を記憶する
- **検索**（ファイル名・ファイル形式・年月・日付範囲）
- ファイル画面の履歴ボタンから、**そのファイル名で絞り込んだ状態**で開く

タグ・ロック・容量監視は第 3 期。

## バイナリの本文抽出について

設計書には「バイナリは本文を抽出して差分を出す」とあるが、
**アプリにはバイナリを更新する経路が無い**（アップロードは常に新規作成）。
差分が生じる場面が存在しないため、第 2 期では実装しない。
更新の経路を作るときに合わせて対応する。

---

## Task 1: 検索条件のドメイン `lib/domain/history-filter.ts`

**Produces:**
- `HistoryFilter = { fileName: string; extension: string; from: string; to: string }`
- `EMPTY_FILTER`
- `parseFilter(params): HistoryFilter` — 画面の問い合わせから読む
- `toSearchParams(filter): URLSearchParams`
- `isEmptyFilter(filter): boolean`
- `monthToRange(month: string): { from: string; to: string }` — `2026-09` → 月初と月末
- `validateRange(from, to): string | null` — 開始が終了より後なら文言を返す

**テスト:**
- 空の条件を判定できる
- 年月から**その月の初日と末日**を作る（**月末が 28/29/30/31 のいずれでも正しい**）
- **うるう年の 2 月**を正しく扱う
- 開始が終了より後なら拒否する
- 往復（`toSearchParams` → `parseFilter`）で元に戻る
- 余計な空白を落とす

## Task 2: リポジトリの絞り込み

`listByProject` に `filter` を足す。

- ファイル名: 部分一致（`ilike`）
- 拡張子: 完全一致
- 期間: `created_at` の範囲

**索引を活かすため、期間の絞り込みは `created_at` の範囲比較で行う**
（関数を噛ませると索引が効かない）。

## Task 3: 差分の取得 `lib/actions/history.ts`

**Produces:** `loadHistoryDetailAction(formData): Result<{ changes: Change[]; truncated: boolean }>`

一覧には差分を載せず、**クリックしたときだけ取りに行く**。
一覧に全件の差分を積むと、無限スクロールで重くなるため。

## Task 4: 分割表示 `components/app/history-split.tsx`

- 左に一覧、右に差分。**ページは切り替えない**
- 境界をドラッグして比率を変更
- 比率は `localStorage` に記憶し、次回以降も適用する
- 差分が未選択のときは一覧を全幅で表示する
- 狭い画面では上下に積む

**テスト:** 比率の記憶と復元、下限・上限の制限、未選択時の全幅

## Task 5: 検索欄 `components/app/history-search.tsx`

ファイル名・形式・年月・日付範囲の入力。条件を変えたら先頭から読み直す。

## Task 6: ファイル画面からの導線

「変更履歴」を `/history?fileName=<ファイル名>` へ変更し、
開いた時点で絞り込まれた状態にする。

## Task 7: 検証と worklog

lint / typecheck / test / build と実機確認、`docs/worklog/` に記録。
