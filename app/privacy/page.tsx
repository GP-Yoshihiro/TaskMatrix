import Link from 'next/link'
import type { Metadata } from 'next'

/**
 * プライバシーポリシー。
 *
 * ログイン不要で開ける必要があるため、認証を要求する (app) の外に置く。
 * Google の OAuth 公開申請でこの URL の提出が求められる。
 *
 * 記載はすべて**実装の事実**に基づく。
 * 実装を変えたときは、この文書も合わせて直すこと。
 */

export const metadata: Metadata = {
  title: 'プライバシーポリシー - TaskMatrix',
  description: 'TaskMatrix が取り扱う情報と、その送信先についての説明です。',
}

/** 問い合わせ先 */
const CONTACT = 'yoshi.lb.ex@gmail.com'

const LAST_UPDATED = '2026-09-03'

const section = {
  display: 'grid',
  gap: 8,
  marginTop: 28,
} as const

const heading = {
  fontSize: '1.05rem',
  fontWeight: 650,
} as const

const body = {
  fontSize: '0.9rem',
  lineHeight: 1.8,
} as const

const cell = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--color-border)',
  fontSize: '0.85rem',
  verticalAlign: 'top',
  textAlign: 'left',
} as const

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '40px 20px 80px',
      }}
    >
      <h1 style={{ fontSize: '1.6rem', fontWeight: 650, letterSpacing: '-0.01em' }}>
        プライバシーポリシー
      </h1>
      <p style={{ ...body, color: 'var(--color-fg-muted)', marginTop: 8 }}>
        TaskMatrix（以下「本アプリ」）が取り扱う情報と、その送信先について説明します。
        <br />
        最終更新日: {LAST_UPDATED}
      </p>

      <section style={section}>
        <h2 style={heading}>1. 本アプリについて</h2>
        <p style={body}>
          本アプリは、プロジェクトの資料・タスク・予定を管理するためのものです。
          利用には登録が必要で、登録した本人だけが自分のデータを閲覧・編集できます。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>2. 保存する情報</h2>
        <p style={body}>本アプリは次の情報を保存します。</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...cell, fontWeight: 600 }}>種類</th>
                <th style={{ ...cell, fontWeight: 600 }}>内容</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={cell}>アカウント</td>
                <td style={cell}>メールアドレス、表示名（任意）、表示テーマの設定</td>
              </tr>
              <tr>
                <td style={cell}>資料</td>
                <td style={cell}>
                  プロジェクト名、フォルダ名、ファイル名、
                  <strong>アップロードしたファイルの内容</strong>
                </td>
              </tr>
              <tr>
                <td style={cell}>作業の情報</td>
                <td style={cell}>タスク、予定、タグ、稼働条件</td>
              </tr>
              <tr>
                <td style={cell}>AI との対話</td>
                <td style={cell}>質問と回答、検索用に分割した本文とその埋め込み</td>
              </tr>
              <tr>
                <td style={cell}>変更履歴</td>
                <td style={cell}>
                  ファイルの追加・編集・削除の記録と、
                  <strong>変更された行の内容</strong>
                </td>
              </tr>
              <tr>
                <td style={cell}>利用状況</td>
                <td style={cell}>AI の使用トークン量と所要時間</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section style={section}>
        <h2 style={heading}>3. 保存場所</h2>
        <p style={body}>
          データは <strong>Supabase</strong>（データベースおよびファイル保管）に保存され、
          アプリ自体は <strong>Vercel</strong> 上で動作します。
          ファイルは非公開の保管領域に置かれ、閲覧には期限付きの URL が必要です。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>4. 外部サービスへ送信する情報</h2>
        <p style={body}>
          AI 機能とカレンダー連携のため、次の情報を外部へ送信します。
          <strong>送信は、利用者がその機能を実行したときにのみ行われます。</strong>
        </p>

        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: 12 }}>
          Google Gemini API
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...cell, fontWeight: 600 }}>機能</th>
                <th style={{ ...cell, fontWeight: 600 }}>送信する情報</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={cell}>タスク抽出</td>
                <td style={cell}>
                  ファイルの本文
                  <br />
                  <span style={{ color: 'var(--color-fg-muted)' }}>
                    ファイル名・プロジェクト名・アカウント情報は送信しません
                  </span>
                </td>
              </tr>
              <tr>
                <td style={cell}>スケジュール算出</td>
                <td style={cell}>
                  未完了タスクの名称・説明・優先度・期限、稼働条件、確定済みの予定
                  <br />
                  <span style={{ color: 'var(--color-fg-muted)' }}>
                    ファイルの本文・プロジェクト名・アカウント情報は送信しません
                  </span>
                </td>
              </tr>
              <tr>
                <td style={cell}>AI チャット</td>
                <td style={cell}>
                  ファイルの本文とファイル名、入力された質問
                  <br />
                  <span style={{ color: 'var(--color-fg-muted)' }}>
                    プロジェクト名・フォルダ名・アカウント情報は送信しません
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: 16 }}>
          Google Calendar API
        </h3>
        <p style={body}>
          カレンダー連携を有効にした場合、確定した予定の
          <strong>タスク名・日時・算出理由</strong>を送信します。
        </p>
        <p style={body}>
          本アプリが要求する権限は{' '}
          <code style={{ fontSize: '0.85em' }}>calendar.app.created</code> のみです。
          これは<strong>本アプリが作成したカレンダーだけ</strong>を読み書きできる権限で、
          利用者の既存のカレンダーを閲覧・変更することはできません。
        </p>
        <p style={body}>
          連携時に Google から受け取る再接続用のトークンは、
          <strong>暗号化して保存</strong>します。復号のための鍵はデータベースの外に置きます。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>5. 第三者への提供</h2>
        <p style={body}>
          上記 4 に記載した機能の実現に必要な送信を除き、
          <strong>第三者へ情報を提供することはありません。</strong>
          広告目的での利用や、AI の学習用データとしての提供も行いません。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>6. Cookie の利用</h2>
        <p style={body}>
          ログイン状態の保持と表示テーマの記憶のためにのみ Cookie を使用します。
          広告や行動追跡のための Cookie は使用しません。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>7. 保存期間</h2>
        <ul style={{ ...body, paddingLeft: '1.4em', listStyle: 'disc' }}>
          <li>
            アカウントと資料は、利用者が削除するまで保存します。
          </li>
          <li>
            <strong>ファイルの過去の版は保持しません。</strong>
            変更履歴には変更された箇所のみを保存します。
          </li>
          <li>
            変更履歴は期限では削除しません。
            データベースの容量が上限に近づいたときにのみ、
            保護の印を付けたファイルの履歴を除いて古い順に削除します。
          </li>
        </ul>
      </section>

      <section style={section}>
        <h2 style={heading}>8. 情報の削除</h2>
        <ul style={{ ...body, paddingLeft: '1.4em', listStyle: 'disc' }}>
          <li>ファイル・フォルダ・プロジェクトは、画面から削除できます。</li>
          <li>
            カレンダー連携は画面から解除できます。
            <strong>解除しても、Google 側に作成されたカレンダーと予定は残ります。</strong>
            不要な場合は Google カレンダーから削除してください。
          </li>
          <li>
            <strong>アカウントは、設定画面からご自身で削除できます。</strong>
            削除すると、プロジェクト・ファイル・タスク・予定・変更履歴・
            AI との対話・利用状況の記録が<strong>すべて削除されます</strong>。
            アップロードしたファイルの実体も削除します。
          </li>
          <li>
            アカウントの削除は取り消せません。
            誤って実行しないよう、確認としてご自身のメールアドレスの入力を求めます。
          </li>
        </ul>
      </section>

      <section style={section}>
        <h2 style={heading}>9. 本ポリシーの変更</h2>
        <p style={body}>
          本アプリの機能を変更した際は、本ポリシーもあわせて更新します。
          変更した場合は最終更新日を改めます。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>10. お問い合わせ</h2>
        <p style={body}>{CONTACT}</p>
      </section>

      <p style={{ marginTop: 36, fontSize: '0.85rem' }}>
        <Link href="/login">ログイン画面へ戻る</Link>
      </p>
    </main>
  )
}
