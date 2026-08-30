# CLAUDE.md — TaskMatrix 開発における動作規則

本ファイルは、TaskMatrix プロジェクトにおける Claude（AI エージェント）の**動作規則**を定義する。
本ファイルの規則は、以降のすべてのセッション・すべての作業に対して適用される。

---

## 0. 前提

- プロジェクト名: **TaskMatrix**
- リポジトリ: `GP-Yoshihiro/TaskMatrix`（private 前提）
- 仕様の一次情報源: `README.md`
- 本ファイルの規則と他の指示が矛盾する場合、**ユーザーの明示的な直接指示 > 本ファイル > スキル/プラグイン > 既定動作** の順で優先する。

---

## 1. 絶対遵守ルール（ユーザー指定・変更不可）

### R-01. 機密保持 / 外部流出の禁止
- 本プロジェクトのソースコード・仕様・設計・データ・スクリーンショット等を、**いかなる外部サービスにも送信・公開しない**。
- 具体的に禁止する行為:
  - Artifact 等による Web 公開（`Artifact` ツールでの publish）
  - Gist / Pastebin / 外部ストレージへのアップロード
  - Web 検索・Web フェッチのクエリやリクエストに、本プロジェクト固有のコード・仕様文言を含めること
  - 外部 AI サービス・学習用データセットへの情報提供
  - 第三者向けのレポート・要約の外部配信
- 一般的な技術情報の検索は可。ただし**プロジェクト固有情報を一切含めない**こと。
- GitHub への push は、上記リポジトリ（private）に限り許可する。**public 化は禁止**。

### R-02. 応答言語
- 開発におけるユーザーへの応答・説明・確認・コミットメッセージ・PR 本文は**すべて日本語**とする。
- コード内の識別子は英語、コメント・ドキュメントは日本語を基本とする。

### R-03. 機能単位のブランチ運用
- アプリの機能を追加・変更するごとに、**必ず新規ブランチを作成**して作業する。
- `main` への直接コミットは禁止（例外: 本ファイル等のメタ文書の初期整備でユーザーが明示的に許可した場合のみ）。

### R-04. 確認の頻度
- コミット・PR の内容確認をユーザーに求めるのは**必要なときのみ**でよい。
- 判断に迷う変更・破壊的変更・仕様解釈が分かれる箇所は必ず確認する。

### R-05. 随時の動作確認
- 実装の各区切りで動作確認を行い、**エラー状態でないこと**を確認する。
- 最低限の確認セット（グリーンであること）:
  1. `npm run lint`
  2. `npm run typecheck`（または `tsc --noEmit`）
  3. `npm test`（テストが存在する場合）
  4. `npm run build`
  5. 画面が絡む場合は実際に起動して表示・操作を確認

### R-06. エラー状態での Git 操作の禁止
- 上記 R-05 の確認がグリーンでない状態での **commit / push / PR 作成を禁止**する。
- 途中保存が必要な場合は、コミットせずに作業ツリーに留めるか、ユーザーに相談する。

### R-07. superpowers プラグインの利用
- `superpowers@claude-plugins-official` を導入済みとし、該当するスキルは必ず起動する。
- 主に用いるスキル:
  - 設計前: `superpowers:brainstorming`
  - 計画作成: `superpowers:writing-plans`
  - 実装: `superpowers:test-driven-development`
  - 不具合対応: `superpowers:systematic-debugging`
  - 完了判定: `superpowers:verification-before-completion`

### R-08. 音声ガイド
- 次のタイミングで、macOS の `say` コマンドにより**日本語音声で通知**する。
  - ユーザーに承認・判断を求めるとき
  - 実装・タスクが完了したとき
  - エラーで作業が停止したとき
- 実行形式:
  ```bash
  say -v Kyoko "メッセージ"
  ```
- 音声メッセージは**短く（目安 40 文字以内）**、機密情報（キー・パス・コード断片）を含めないこと。

### R-09. トークン削減
- ソースコードの解析は**最小限**に留める。
- 具体策:
  - 全文読み込みより、`grep` / `sed -n 'X,Yp'` による**必要範囲のみの読み取り**を優先
  - 一度読んだ内容・確定した事実は**再読み込みしない**（会話コンテキストをキャッシュとして活用）
  - 検証済みのチェックが通った後、同じチェックを再実行しない
  - 依存のない読み取り・検索・編集は**1 メッセージにまとめて並列実行**
  - `node_modules` / `.next` / ビルド成果物は検索対象から除外

### R-10. 不明確なまま進めない
- 仕様が不明確・複数解釈が可能な状態で、**推測による実装を進めない**。
- 必ずユーザーに確認し、回答を得て明確化してから着手する。
- 確認待ちの間は、その判断に依存しない作業のみ進めてよい。

---

## 2. 追加ルール（Claude が本プロジェクト向けに定義）

### R-11. 設計・計画の先行
- 新機能の実装前に、`brainstorming` → 設計合意 → `writing-plans` の順で進める。
- 設計書は `docs/specs/` に、実装計画は `docs/plans/` に日本語で保存する。

### R-12. テスト駆動開発（TDD）
- 原則として **失敗するテストを先に書き**、実装で通し、リファクタする。
- 対象: ドメインロジック、API ルート、ユーティリティ。UI の見た目のみの調整は対象外。

### R-13. ブランチ・コミット規約
- ブランチ名: `feature/<機能名>` / `fix/<不具合名>` / `chore/<作業名>` / `docs/<文書名>`
- コミットメッセージ: Conventional Commits + 日本語本文
  ```
  feat(tasks): AIタスク抽出APIを追加

  - Gemini APIクライアントを実装
  - 抽出結果のスキーマ検証を追加
  ```
- 1 コミット = 1 つの意味のある変更単位。

### R-14. 秘密情報の取り扱い
- API キー・トークン・接続文字列は**必ず環境変数**（`.env.local`）で管理し、コミットしない。
- `.env*` は `.gitignore` 済みであることを毎回確認する。
- ログ・エラーメッセージ・音声ガイドに秘密情報を出力しない。
- サーバー専用キー（Supabase Service Role Key、Gemini API Key）を**クライアントバンドルに含めない**。`NEXT_PUBLIC_` 接頭辞を安易に付けない。

### R-15. 破壊的操作の事前確認
- 以下は実行前に必ずユーザー確認を取る。
  - `git push --force` / ブランチ削除 / 履歴書き換え
  - ファイル・ディレクトリの一括削除
  - DB のマイグレーション適用・データ削除
  - 外部サービスへのデプロイ（Vercel 等）
  - 依存パッケージの大規模アップデート

### R-16. 完了報告の誠実性
- 「完了」「動作する」「テストが通った」と述べる前に、**必ず実際にコマンドを実行し出力を確認**する。
- 未実施・未確認の項目は、その旨を明記する。憶測で成功を報告しない。
- 失敗した場合は、隠さず出力とともに報告する。

### R-17. スコープ厳守
- 依頼されていないリファクタリング・機能追加・ドキュメント生成を行わない。
- 作業中に発見した改善点は、実装せず**メモとして報告**する。

### R-18. 実装の記録
- 各機能ブランチの作業内容は `docs/worklog/` に日本語で簡潔に残す（何を・なぜ・どう確認したか）。

### R-19. 依存追加の方針
- 新規パッケージ追加は、代替がなく明確な必要性がある場合に限る。追加時は理由を報告する。

### R-20. 中断・再開
- セッションが切れても再開できるよう、進行中の計画・残タスクは `docs/plans/` に反映しておく。

---

## 3. 標準ワークフロー

```
1. 要件確認（不明点はユーザーに確認）  ← R-10
2. 設計 → ユーザー承認（音声ガイド）    ← R-08, R-11
3. 機能ブランチ作成                    ← R-03, R-13
4. TDD で実装                          ← R-12
5. 動作確認（lint / typecheck / test / build / 起動）← R-05
6. グリーン確認後にコミット             ← R-06
7. 必要に応じて push / PR               ← R-04
8. 完了報告（音声ガイド）               ← R-08, R-16
```

---

## 4. 技術スタック（README.md 準拠）

| 区分 | 採用技術 |
|------|----------|
| フロントエンド | Next.js (App Router) / React / TypeScript / PWA |
| バックエンド・DB | Supabase (PostgreSQL / Auth / Storage) |
| AI | Google Gemini API |
| デプロイ | Vercel |
| コード管理 | GitHub (private) |
| 対象環境 | macOS / iOS / iPadOS / watchOS |

---

## 5. 禁止事項サマリ

- ❌ プロジェクト情報の外部送信・公開（R-01）
- ❌ 日本語以外での開発応答（R-02）
- ❌ `main` への直接コミット（R-03）
- ❌ エラー状態での commit / push / PR（R-06）
- ❌ 秘密情報のコミット・出力（R-14）
- ❌ 不明確なままの推測実装（R-10）
- ❌ 未確認での完了報告（R-16）
- ❌ 依頼外の作業（R-17）

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
