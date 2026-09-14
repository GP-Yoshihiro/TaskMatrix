# プロジェクトメンバーとセクション 実装計画

設計書: `docs/specs/2026-09-14-project-members-design.md`

## 第 1 期: メンバーとセクションの土台（完了）

- [x] マイグレーション `0016_members_sections.sql`
      （`project_members` / `sections` / `member_sections` と RLS）
- [x] `lib/domain/member.ts` — 名前の正規化・妥当性（テスト先行）
- [x] `lib/repositories/members.ts` — 一覧・追加・改名・削除・所属の付け外し
- [x] `lib/actions/members.ts` — 画面からの操作
- [x] `app/(app)/projects/[projectId]/members/page.tsx` と部品
- [x] ナビゲーションに「メンバー」を追加
- [x] 検証（lint / typecheck / test / build / 起動）→ PR

## 第 2 期: タスクの担当をメンバーに結び付ける（完了）

- [x] マイグレーション `0017_task_assignee_member.sql`
      （`tasks.assignee_member_id`）
- [x] 担当の解決規則をドメインに置く（メンバー優先、無ければ自由入力）
- [x] タスク編集で担当を選べるようにする
- [x] 予定の担当解決を、タスクのメンバー参照に合わせる
- [x] 検証 → PR

## 第 3 期: ガントチャートの並べ替え

- [ ] 並べ替えの選択（開始日順／担当ごと／セクションごと）
- [ ] 見出しで区切る表示
- [ ] 複属は最初の所属にのみ出し、名前を押すと所属を一覧表示
- [ ] 検証 → PR

## 中断時の再開点

このファイルのチェックを進捗の記録として使う。
