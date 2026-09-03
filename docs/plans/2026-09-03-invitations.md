# 招待コードによる登録制限 — 実装計画

ブランチ: `feature/invitations`

## 目的

URL を知っていれば誰でも登録できる現状をやめ、
**管理者が発行した招待コードを持つ人だけ**が登録できるようにする。

理由は費用。Gemini API のキーはサーバー側の 1 本を全員で共有しており、
登録者の AI 利用がすべて運用者の請求になる。利用回数の上限も無い。

## 前提（ユーザーとの合意事項）

| 項目 | 決定 |
|---|---|
| 既存アカウント | そのまま有効。招待コードは今後の新規登録にのみ適用 |
| コードの性質 | 1 コード＝1 アカウント。使用後は無効 |
| 発行方法 | アプリ内に発行画面を作る |
| 有効期限 | 設ける（既定 14 日） |
| 発行できる人 | 管理者のみ |

## 設計上の要点

### なぜサーバー側でアカウントを作るのか

`signUpAction` の中で照合するだけでは制限にならない。
ブラウザ用のキー（`NEXT_PUBLIC_SUPABASE_ANON_KEY`）はクライアントに埋め込まれており、
そのキーで Supabase の登録エンドポイントを直接叩けば画面を通さず登録できてしまう。

そのため、
1. Supabase 側の公開サインアップを無効化する（運用者の操作）
2. アカウント作成はサービスロールキーで行い、照合を通った場合のみ実行する

管理 API は公開サインアップの設定に縛られないため、この経路だけが残る。

### なぜ「確保してから作る」順なのか

先に照合してから作る順だと、その隙間に同じコードで二重に通る。
`update ... where used_at is null and expires_at > now() returning` の 1 文で
**原子的に確保**し、0 行なら拒否する。
アカウント作成に失敗したら確保を戻し、コードを無駄に潰さない。

### 平文を保存しない

`api_tokens` と同じ流儀。DB が読まれてもコードとして使えないようにする。
代償として発行後に読み返せないため、紛失時は無効化して再発行する。

## 割り切り

- **メールアドレスの実在確認は行わない。** 管理 API で作るため確認メールを経由しない。
  招待コードで人を絞る前提での割り切り

## ファイル構成

| ファイル | 役割 |
|---|---|
| `supabase/migrations/0013_invitations.sql` | `profiles.is_admin`、`invitations` 表、RLS |
| `lib/domain/invitation.ts` | コードの生成・ハッシュ・期限・状態判定 |
| `lib/repositories/invitations.ts` | 表への問い合わせ |
| `lib/usecases/redeem-invitation.ts` | 確保 → 作成 → 失敗時の巻き戻し |
| `lib/actions/invitations.ts` | 発行・無効化 |
| `lib/actions/auth.ts` | `signUpAction` を招待コード必須に変更 |
| `components/features/auth/auth-form.tsx` | 追加項目を差し込めるようにする |
| `components/features/settings/invitation-list.tsx` | 発行画面 |
| `app/(app)/settings/invitations/page.tsx` | 発行画面のルート（管理者のみ） |

## 手順

1. 移行 SQL を書き、適用する
2. `lib/domain/invitation.ts` の失敗するテストを書く → 実装 → 通す
3. 確保の巻き戻しを含む使い方のテストを書く → 実装 → 通す
4. 画面をつなぐ
5. lint / typecheck / test / build を通す
6. コミット → PR

## 運用者の操作（マージ後）

1. Supabase の **Authentication → Sign In / Providers → Confirm email 付近の
   「Allow new users to sign up」を無効化**
2. `profiles` の自分の行の `is_admin` を `true` にする SQL を 1 度実行
