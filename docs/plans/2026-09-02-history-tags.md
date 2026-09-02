# 変更履歴機能 実装計画（第 3 期）

設計書: `docs/specs/2026-09-02-history-log-design.md`
ブランチ: `feature/history-tags`

**方針:** 失敗するテストを先に書き、実装で通す（R-12）。

## 第 3 期の範囲

- **タグ**（ファイルごとに付与。既存の選択と新規作成）
- **ロック**（付いたファイルは削除できない。かつ容量削減の対象外）
- **タグでの絞り込み**（履歴ページ）
- **容量監視と自動削除**（上限に近づいたら、ロック付きを除き古い順に削除）

## 設計上の決定

### タグはファイルに付ける

利用者と合意済み。履歴の絞り込みは「そのファイルの履歴」を引く形になる。

**ファイルを削除すると、そのファイルのタグも消える。**
したがって削除済みファイルの履歴はタグで絞り込めない。
ただし**ロック付きのファイルは削除できない**ため、
「守りたいファイルの履歴が引けなくなる」ことは起こらない。

### ロックが守るもの

| 対象 | 動作 |
|------|------|
| ファイルの削除 | **拒否する** |
| 容量削減による履歴の削除 | **対象外にする** |

### 容量の測り方

`pg_database_size` を返す関数を用意する。
RLS に依存しない値であり、認証済みの利用者なら呼べることを実機で確認済み。
**`security invoker` とする**（権限を広げない）。

閾値は無料枠 500MB の 80%（400MB）とする。
超えている間、ロック付きを除いて古い順に一定件数ずつ消す。

### 削除を実行する契機

履歴ページを開いたとき。第 1 期の方針と揃える。

---

## Task 1: ドメイン `lib/domain/tag.ts`

**Produces:**
- `MAX_TAG_NAME_LENGTH = 20`, `MAX_TAGS_PER_FILE = 10`
- `normalizeTagName(name): string`（前後の空白を落とし、連続する空白を 1 つに）
- `validateTagName(name): string | null`
- `canDeleteFile(tags): boolean`（ロック付きが 1 つでもあれば false）
- `describeLockReason(tags): string`

**テスト:**
- 空白の正規化、空・長すぎる名前の拒否
- **ロックが 1 つでもあれば削除できない**
- ロックが無ければ削除できる
- タグが無ければ削除できる

## Task 2: 容量のドメイン `lib/domain/capacity.ts`

**Produces:**
- `CAPACITY_LIMIT_BYTES`（500MB）, `CAPACITY_THRESHOLD = 0.8`, `PURGE_BATCH = 200`
- `needsPurge(usedBytes): boolean`
- `formatUsage(usedBytes): string`（「12 MB / 500 MB（2%）」）

**テスト:**
- 閾値の前後で判定が変わる
- ちょうど閾値なら消さない（超えたときだけ）
- 表示の桁と単位

## Task 3: マイグレーション `0011_tags.sql`

- `tags`（`project_id` + `name` で一意、`locked`）
- `file_tags`（`file_id` + `tag_id`）
- RLS（自分のプロジェクトのみ）
- `database_size_bytes()` 関数（`security invoker`）

## Task 4: リポジトリ `lib/repositories/tags.ts`

- `listByProject` / `findOrCreate` / `attach` / `detach` / `listByFile`
- `listLockedFileIds(projectId)`（削除の可否と容量削減で使う）

## Task 5: 削除の拒否

`lib/actions/files.ts` の削除で、ロック付きのタグが付いていれば拒否する。
**画面にも理由を出す**（黙って失敗させない）。

## Task 6: 容量監視 `lib/usecases/purge-history.ts`

**Produces:** `purgeHistory(deps, projectId): Promise<{ removed: number }>`

- 容量が閾値以下なら何もしない
- 超えていれば、ロック付きファイルの履歴を除き古い順に `PURGE_BATCH` 件消す

**テスト:** 閾値以下なら消さない、ロック付きは残る、古い順に消す

## Task 7: タグの絞り込み

`HistoryFilter` に `tag` を足し、リポジトリで絞り込む。

## Task 8: 画面

- `components/app/file-tags.tsx` — ファイル画面のタグ編集（既存の選択・新規作成・ロック指定）
- 履歴ページの検索にタグを追加
- 差分の見出しからもタグを編集できるようにする
- 設定画面に容量の表示

## Task 9: 検証と worklog

lint / typecheck / test / build と実機確認、`docs/worklog/` に記録。
