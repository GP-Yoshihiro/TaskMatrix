# Google Calendar 同期 実装計画

設計書: `docs/specs/2026-09-02-google-calendar-design.md`
ブランチ: `feature/google-calendar`

**方針:** 失敗するテストを先に書き、実装で通す（R-12）。

## 全体の制約

- 要求するスコープは `calendar.app.created` のみ（全カレンダーの権限を求めない）
- リフレッシュトークンは暗号化して保存する。平文でログにも応答にも出さない
- **Google への反映に失敗しても TaskMatrix 側の操作は成功させる**
- Google 側の削除は取り込まない（画面に明記する）

---

## Task 1: 暗号化 `lib/domain/crypto.ts`

**Produces:**
- `encryptSecret(plain, keyBase64): string`（`iv:tag:暗号文` を base64 で連結）
- `decryptSecret(payload, keyBase64): string | null`

**テスト:**
- 暗号化 → 復号で元に戻る
- **暗号文に平文が含まれない**
- **同じ平文でも毎回違う暗号文になる**（初期化ベクトルが毎回変わる）
- 鍵が違えば復号できず null
- **1 バイトでも改竄すると null**（認証タグが効いている）
- 鍵の長さが不正なら例外

## Task 2: 差分の判定 `lib/domain/calendar-sync.ts`

**Produces:**
- `toGoogleEvent(schedule): { summary, description, start, end }`
- `diffSchedule(local, remote): { changed: boolean; startsAt: string; endsAt: string }`

**テスト:**
- 日時が同じなら変更なし（**表記ゆれ `+09:00` と `Z` を同一とみなす**）
- 開始だけ/終了だけ変わった場合を検出する
- Google 側が削除済み（`status: 'cancelled'`）なら**取り込まない**
- 予定名や説明の違いは変更とみなさない（日時だけを見る）

## Task 3: マイグレーション `0009_google_calendar.sql`

`google_connections` テーブル、`schedules.google_event_id` の追加、RLS。

## Task 4: リポジトリ `lib/repositories/google-connections.ts`

`find(userId)` / `save(...)` / `updateSyncToken(...)` / `remove(userId)`

## Task 5: Google クライアント `lib/google/calendar.ts`

- `exchangeCode(code)` / `refreshAccessToken(refreshToken)`
- `createCalendar(accessToken)` / `insertEvent` / `patchEvent` / `deleteEvent`
- `listChanges(accessToken, calendarId, syncToken)`
- **`invalid_grant` と 410 を呼び出し側が判別できる形で返す**

## Task 6: OAuth の入口と受け口

- `app/api/google/connect/route.ts` — 同意画面へ送る（`state` で偽装を防ぐ）
- `app/api/google/callback/route.ts` — コードを交換し、カレンダーを作り、保存する

**`state` を検証する。** 検証しないと、第三者が用意した認可コードを
利用者に踏ませて別アカウントへ接続させられる（CSRF）。

## Task 7: 書き出し `lib/usecases/push-schedule.ts`

確定・変更・削除に合わせて Google へ反映。失敗しても Result は成功のまま返す。

## Task 8: 取り込み `lib/usecases/pull-calendar.ts`

差分を取得し、日時が変わった予定だけ更新。`syncToken` 失効時は取り直す。

## Task 9: Server Action と画面

`lib/actions/google-calendar.ts`、`components/app/google-calendar-panel.tsx`。
スケジュール画面へ組み込み、削除を取り込まない旨を明記する。

## Task 10: 検証と worklog

lint / typecheck / test / build、実機での接続・書き出し・取り込み確認。
