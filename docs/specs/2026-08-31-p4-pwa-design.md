# TaskMatrix 第4フェーズ（PWA 対応）設計書

- 作成日: 2026-08-31
- 対象: P4 のうち **PWA 対応**
- 一次仕様: `README.md` の「対象環境: macOS, iOS, iPadOS, watchOS (PWA / ショートカット)」
- 前提: P1 基盤 / P2 AI タスク抽出 / P3 スケジュール
- 動作規則: `CLAUDE.md`

---

## 1. 目的とスコープ

iPhone / iPad / Mac でホーム画面（Dock）に追加し、アプリとして起動できるようにする。
オフライン時は日本語で状況を伝え、復帰後は通常どおり使えるようにする。

### 対象とするもの

- Web App Manifest（アプリ名・アイコン・表示モード・テーマ色）
- Service Worker による**アプリの枠**（App Shell）のキャッシュ
- オフライン時の案内ページ（日本語）
- 各サイズのアイコン生成
- iOS 固有のメタタグ（`apple-mobile-web-app-*`）
- Service Worker の更新検知と再読み込みの案内

### 対象としないもの

**利用者のデータのオフラインキャッシュは行わない。**
タスク・予定・ファイル本文はキャッシュせず、オフライン時は案内を出す。

見送る理由は、古いデータを最新のように見せてしまう危険があるため。
「いつ時点の情報か」を正しく伝える仕組みまで作らないと、
かえって判断を誤らせる。まず枠だけを確実に動かす。

Web Push 通知、オフライン編集と同期、バックグラウンド同期も対象外。

---

## 2. 確定した仕様判断

| 論点 | 確定 | 理由 |
|---|---|---|
| オフラインの範囲 | **アプリの枠のみ** | 古いデータを見せる危険を避ける。実装と検証が確実 |
| Web Push | **含めない** | VAPID 鍵・購読管理・配信基盤が必要で、別件として設計すべき |
| アイコン | **生成する** | 既存のデザイントークンの色を使い、後から差し替え可能にする |
| Service Worker | **自前実装** | `next-pwa` 等は Next.js 16 での動作が不確実。依存を増やさない |

---

## 3. アーキテクチャ

### 3.1 追加するファイル

```
public/
  manifest.webmanifest      アプリの定義
  icons/icon-192.png        ホーム画面用
  icons/icon-512.png        スプラッシュ用
  icons/icon-maskable.png   Android のマスカブル対応
  icons/apple-touch-icon.png iOS 用（180px）
  sw.js                     Service Worker
app/
  offline/page.tsx          オフライン時の案内
  layout.tsx                manifest とメタタグの追加（変更）
components/app/
  service-worker-register.tsx  登録と更新検知
lib/domain/
  pwa.ts                    キャッシュ対象の判定（純粋関数）
```

### 3.2 Service Worker の方針

**キャッシュするもの**（App Shell）

- `/offline`（オフライン案内ページ）
- `/manifest.webmanifest`
- `/icons/*`
- Next.js のビルド成果物（`/_next/static/*`）

**キャッシュしないもの**

- HTML のページ（常にネットワークから取得する）
- Server Actions の POST
- `/api/*`
- Supabase / Gemini への通信

戦略は次のとおり。

| 種類 | 戦略 | 理由 |
|---|---|---|
| ナビゲーション（HTML） | ネットワーク優先。失敗したら `/offline` を返す | 常に最新を見せる。古い画面を出さない |
| `/_next/static/*` | キャッシュ優先 | ハッシュ付きで内容が変わらない |
| アイコン・manifest | キャッシュ優先 | 変更頻度が低い |
| それ以外 | 素通し | 認証や API に手を出さない |

**GET 以外は一切介入しない。** Server Actions は POST なので影響を受けない。

### 3.3 更新の扱い

Service Worker を更新したとき、古い版が残り続けると
修正が届かない。次のようにする。

1. `install` で `skipWaiting()` を呼ぶ
2. `activate` で古いキャッシュを削除し `clients.claim()` する
3. 画面側で `controllerchange` を監視し、
   更新を検知したら「新しい版があります」と案内して再読み込みを促す

自動で再読み込みはしない。入力中の内容が失われるおそれがあるため。

---

## 4. Manifest

| 項目 | 値 |
|---|---|
| `name` | TaskMatrix |
| `short_name` | TaskMatrix |
| `description` | フォルダ・タスク・スケジュール管理アプリケーション |
| `start_url` | `/` |
| `scope` | `/` |
| `display` | `standalone` |
| `orientation` | `any` |
| `background_color` | `#ffffff` |
| `theme_color` | `#0071e3`（Apple テーマのアクセント色） |
| `lang` | `ja` |
| `icons` | 192 / 512 / maskable |

`start_url` を `/` にするのは、既存の振り分け（未認証ならログイン、
認証済みならダッシュボード）をそのまま使えるため。

---

## 5. iOS 対応

iOS はまだ manifest だけでは足りないため、メタタグを併記する。

- `apple-mobile-web-app-capable: yes`
- `apple-mobile-web-app-status-bar-style: default`
- `apple-mobile-web-app-title: TaskMatrix`
- `apple-touch-icon`（180px）

**iOS では Service Worker の挙動に制約がある**（ストレージが一定期間で
破棄されることがある）。枠のキャッシュだけなので、失われても
再取得すれば復旧する設計になっている。

---

## 6. アイコンの生成

外部ツールを増やさず、Node の標準機能だけで PNG を生成する。
デザインは既存のトークンに合わせる。

- 背景: `#0071e3`（Apple テーマのアクセント色）
- 前景: 白の「TM」または格子のモチーフ
- マスカブル用は安全領域（中央 80%）に収める

生成スクリプトは `scripts/generate-icons.mjs` に置き、
後から差し替えられるようにする。生成した PNG はリポジトリにコミットする
（ビルド時に生成すると環境差で壊れうるため）。

---

## 7. オフライン案内ページ

`/offline` は Service Worker がキャッシュするため、
**Supabase に依存してはならない**。認証チェックも行わない静的なページにする。

内容:

- 「オフラインです」の見出し
- 「インターネット接続をご確認ください。接続が戻ると自動で利用できます。」
- 「再読み込み」ボタン
- 既存のデザイントークンを使う（テーマは Cookie から解決済みのものが適用される）

---

## 8. テストと検証

### 8.1 テスト

- **単体**: `lib/domain/pwa.ts`（キャッシュ対象の判定・戦略の選択）
- Service Worker 自体は jsdom で動かせないため、
  **判定ロジックを純粋関数に切り出して**そこをテストする

### 8.2 実機での確認

1. `manifest.webmanifest` が 200 で返り、正しい JSON である
2. Service Worker が登録され `activated` になる
3. アイコンがすべて 200 で返る
4. **オフラインにしてページ遷移すると `/offline` が表示される**
5. オンラインに戻すと通常どおり使える
6. Server Actions（タスク作成など）が Service Worker の影響を受けない
7. Lighthouse 相当の観点（manifest / SW / アイコン）を手動で確認する

---

## 9. ブランチ計画

| 順 | ブランチ | 内容 |
|---|---|---|
| 1 | `docs/spec-p4-pwa` | 本設計書と実装計画 |
| 2 | `feature/pwa-manifest` | manifest・アイコン生成・iOS メタタグ |
| 3 | `feature/pwa-service-worker` | Service Worker・オフラインページ・更新検知 |

---

## 10. 依存パッケージ

**追加なし。** アイコン生成も Service Worker も自前で実装する。

`next-pwa` などのライブラリは Next.js 16 / Turbopack での動作が
確認できておらず、依存を増やす割に得られるものが少ないと判断した。

---

## 11. P4-PWA の完了条件

1. `manifest.webmanifest` が正しい JSON として配信される
2. アイコン（192 / 512 / maskable / apple-touch）がすべて配信される
3. Service Worker が登録され `activated` になる
4. オフライン時にページ遷移すると `/offline` が日本語で表示される
5. オンラインに戻すと通常どおり動作する
6. Server Actions が Service Worker の影響を受けない
7. `/api/*` と Supabase への通信をキャッシュしない
8. Service Worker の更新を検知して再読み込みを案内する（自動再読み込みはしない）
9. iOS 用のメタタグが出力される
10. `lint` / `typecheck` / `test` / `build` がすべてグリーン
