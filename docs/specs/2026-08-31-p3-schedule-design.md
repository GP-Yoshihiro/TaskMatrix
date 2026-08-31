# TaskMatrix 第3フェーズ（スケジュール自動算出）設計書

- 作成日: 2026-08-31
- 対象: P3 スケジュールフェーズ
- 一次仕様: `README.md` の「③ スケジュール自動算出機能」
- 前提となる設計: P1 基盤 / P2 AI タスク抽出
- 動作規則: `CLAUDE.md`

---

## 1. 目的とスコープ

P2 で作られたタスクに対し、AI が実行日時を算出して提案し、
ユーザーが確定したものをカレンダーに反映する。

### 対象とするもの

- 稼働日・稼働時間帯を考慮した AI によるスケジュール算出
- **算出理由の明記**（なぜその日時に割り当てたか）
- 仮案プレビュー → ユーザーの「確定」でカレンダーへ反映
- 自前実装の月間カレンダービュー
- Apple カレンダー等に取り込める **.ics 書き出し**
- 稼働条件（稼働曜日・時間帯・1日の上限時間）の設定画面

### 対象としないもの

Google Calendar API による双方向同期（P4 へ）、
.ics のインポート、既存予定との衝突回避、
複数人でのリソース調整、繰り返し予定。

---

## 2. 確定した仕様判断

| 論点 | 確定 | 理由 |
|---|---|---|
| カレンダー連携 | **.ics 書き出しのみ**。Google Calendar は P4 | OAuth 設定が利用者側の作業を要するため、まず外部設定なしで使える形にする |
| 算出条件 | **稼働日・稼働時間帯を考慮**。所要時間も AI に推定させる | 期限と優先度だけでは実行可能な計画にならない |
| カレンダー UI | **自前の月間ビュー** | 依存を増やさず、デザイントークンとプラットフォームテーマに追従できる |
| 確定前の保存 | **しない**（P2 と同じ非破壊方針） | 仮案を勝手に保存すると既存の確定予定を壊しかねない |

### 意図的に見送った点

**既存の確定済みスケジュールとの衝突回避は行わない。**
そのため再算出すると既存予定と時間が重なる可能性がある。
これを補うため、カレンダー画面では確定済みの予定と仮案を同じ画面に並べて表示し、
重なりを利用者が目で確認できるようにする。衝突の自動回避は後続フェーズで検討する。

---

## 3. データモデル

```
schedules
  id          uuid PK
  project_id  uuid not null -> projects(id) ON DELETE CASCADE
  task_id     uuid not null -> tasks(id)    ON DELETE CASCADE
  starts_at   timestamptz not null
  ends_at     timestamptz not null
  reason      text not null default ''   -- AI による算出理由
  created_by  uuid not null -> profiles(id)
  created_at  timestamptz
  updated_at  timestamptz

work_settings          -- 利用者ごとの稼働条件。1 ユーザー 1 行
  user_id        uuid PK -> profiles(id) ON DELETE CASCADE
  work_days      smallint[] not null default '{1,2,3,4,5}'  -- 0=日 〜 6=土
  work_start     time not null default '09:00'
  work_end       time not null default '18:00'
  daily_capacity_minutes integer not null default 360        -- 1 日に割り当てる上限
  timezone       text not null default 'Asia/Tokyo'
  updated_at     timestamptz
```

`schedules` は**確定済みのものだけ**を保持する。仮案は画面上の状態としてのみ存在する。

`task_id` を `ON DELETE CASCADE` にする理由は、タスクが消えた予定を残しても
意味を持たないため。`tasks` 側の削除ダイアログにその旨を明記する。

RLS は P1・P2 と同じく `projects.owner_id = auth.uid()` を起点とする。
`work_settings` は `user_id = auth.uid()`。

---

## 4. R-21 に基づく外部送信の内容

| 項目 | 内容 |
|---|---|
| **何を** | 未完了タスクの一覧（タスク名・説明・優先度・期限）、稼働条件、今日の日付 |
| **どこへ** | Google Gemini API（Interactions API） |
| **なぜ** | 実行日時と所要時間を算出し、その理由を生成するため |
| **どうなるか** | 有料 API 経由では学習に使用されない方針。無料枠では学習に利用される場合がある |

### 送信しないもの

ファイルの本文、ファイル名、プロジェクト名、フォルダ名、
ユーザーのメールアドレスや ID、Supabase のキー類、確定済みスケジュール。

---

## 5. アーキテクチャ

P1・P2 の方針を継承する。読み取りは Server Components、書き込みは Server Actions。
Gemini への依存は `lib/gemini` に閉じ込め、`lib/usecases` はインターフェース越しに呼ぶ。

**例外として `.ics` の書き出しのみ Route Handler を使う。**
ファイルダウンロードには `Content-Disposition` ヘッダーが必要で、
Server Action では扱えないため。P1 設計書 §5.1 で「必要になった時点で
Route Handlers を追加する」と決めていた通りの追加である。

```
app/
  (app)/projects/[projectId]/schedule/     カレンダー画面
  (app)/settings/                          稼働条件の設定を追加
  api/projects/[projectId]/schedule.ics/   .ics 書き出し（Route Handler）
lib/
  domain/schedule.ts     稼働日判定・時間帯の検証・重なり判定
  domain/ics.ts          .ics 文字列の組み立て
  domain/calendar.ts     月間グリッドの組み立て
  gemini/plan-schedule.ts  算出プロンプトと構造化スキーマ
  repositories/schedules.ts
  repositories/work-settings.ts
  usecases/plan-schedule.ts
  actions/schedules.ts
components/app/
  schedule-planner.tsx   算出実行と仮案プレビュー
  calendar-month.tsx     月間ビュー
  work-settings-form.tsx 稼働条件の設定
```

---

## 6. 算出フロー

```
1. カレンダー画面で「スケジュールを算出」を押す
2. 送信内容の確認ダイアログを表示（R-21）
3. 未完了タスク（status <> 'done'）と稼働条件、今日の日付を Gemini に送る
4. 構造化出力で 各タスクの開始日時・終了日時・算出理由 を受け取る
5. 稼働日・稼働時間帯の範囲内かをサーバー側で検証し、外れた提案は補正または除外する
6. 【仮案】としてカレンダー上に確定済みと区別して表示（この時点では保存しない）
7. ユーザーがチェックを付けて「確定」
8. 選択されたものだけを schedules に保存
```

AI の出力を鵜呑みにせず、**稼働条件の範囲内かをサーバー側で必ず検証する**。
P2 で AI が `due_date` に自然言語を返した実績があるため、日時も同様に信用しない。

### Gemini への出力スキーマ

```
{
  schedules: [
    {
      task_title: string    // どのタスクに対する提案か（照合用）
      starts_at: string     // ISO 8601（例 2026-09-01T09:00:00+09:00）
      ends_at: string       // ISO 8601
      reason: string        // なぜその日時にしたか。日本語
    }
  ],
  overall_note: string      // 全体方針の説明。1〜3文
}
```

---

## 7. .ics 書き出し

RFC 5545 に沿った最小構成を自前で組み立てる（ライブラリを増やさない）。

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//TaskMatrix//JA
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:<schedule id>@taskmatrix
DTSTAMP:<生成時刻 UTC>
DTSTART:<開始 UTC>
DTEND:<終了 UTC>
SUMMARY:<タスク名>
DESCRIPTION:<算出理由>
END:VEVENT
END:VCALENDAR
```

注意点:

- 日時は **UTC の `YYYYMMDDTHHMMSSZ` 形式**で書く
- 1 行は 75 オクテット以内に折り返す（超える行は次行を空白で開始する）
- `SUMMARY` と `DESCRIPTION` の `\` `;` `,` と改行をエスケープする
- 改行コードは **CRLF**

---

## 8. エラー処理

追加するエラーコード:

| コード | 発生条件 | 表示メッセージ |
|---|---|---|
| `NO_SCHEDULABLE_TASKS` | 未完了タスクが 0 件 | 予定を立てるタスクがありません。 |
| `INVALID_SCHEDULE_RANGE` | AI の日時が解釈できない・稼働条件から大きく外れる | 算出結果を解釈できませんでした。もう一度お試しください。 |

既存の `AI_*` 系のコードは P2 のものをそのまま使う。

---

## 9. テストと検証

- **単体**: `lib/domain/schedule.ts`（稼働日判定・範囲検証・重なり判定）、
  `lib/domain/ics.ts`（エスケープ・行折り返し・UTC 変換）、
  `lib/domain/calendar.ts`（月間グリッド）
- **ユースケース**: Gemini をモックした `planSchedule`。**実 API は呼ばない**
- **実機**: 開発サーバーで算出 → 仮案表示 → 確定 → .ics 書き出しまでを通しで確認し、
  書き出した .ics を実際に Apple カレンダーで開けることを確認する

---

## 10. ブランチ計画

| 順 | ブランチ | 内容 |
|---|---|---|
| 1 | `docs/spec-p3` | 本設計書と実装計画 |
| 2 | `feature/schedule-schema` | `schedules` / `work_settings` と RLS、ドメインロジック |
| 3 | `feature/work-settings` | 稼働条件の設定画面 |
| 4 | `feature/schedule-planner` | AI 算出・検証・仮案プレビュー・確定 |
| 5 | `feature/calendar-view` | 月間カレンダービュー |
| 6 | `feature/ics-export` | .ics 書き出し |

---

## 11. 依存パッケージ

**追加なし。** 日付処理は標準の `Date` と `Intl` で行い、
.ics は自前で組み立てる。カレンダー UI も自前実装とする。

---

## 12. P3 の完了条件

1. 稼働条件（曜日・時間帯・1日の上限）を設定でき、保存される
2. 未完了タスクからスケジュール仮案を算出できる
3. 各提案に**算出理由**が日本語で表示される
4. 稼働日・稼働時間帯から外れた提案が補正または除外される
5. 仮案と確定済みがカレンダー上で区別して表示される
6. チェックしたものだけが確定・保存される
7. 確定前の状態では `schedules` に保存されない
8. 月間カレンダーで前後の月に移動できる
9. .ics を書き出せ、Apple カレンダーで開ける
10. タスクが 0 件のときに日本語メッセージが出る
11. 他ユーザーのスケジュールにアクセスできない
12. `lint` / `typecheck` / `test` / `build` がすべてグリーン
