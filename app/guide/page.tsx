import Link from 'next/link'
import type { Metadata } from 'next'
import { DAILY_CALL_LIMIT, DAILY_TOKEN_LIMIT } from '@/lib/domain/ai-limit'

/**
 * 使い方の案内。
 *
 * 開発環境を持たない人に URL を 1 つ送れば済むよう、
 * 認証を要求する (app) の外に置く。ログイン前から読める。
 *
 * 記載はすべて**実際の画面の表記**に合わせる。
 * 画面の文言を変えたときは、この文書も合わせて直すこと。
 */

export const metadata: Metadata = {
  title: '使い方 - TaskMatrix',
  description: 'TaskMatrix の始め方と、基本的な使い方の案内です。',
}

const LAST_UPDATED = '2026-09-03'

const section = { display: 'grid', gap: 8, marginTop: 32 } as const
const heading = { fontSize: '1.05rem', fontWeight: 650 } as const
const subheading = { fontSize: '0.95rem', fontWeight: 600, marginTop: 14 } as const
const body = { fontSize: '0.9rem', lineHeight: 1.85 } as const
const list = { ...body, paddingLeft: '1.4em', listStyle: 'disc', margin: 0 } as const
const ordered = { ...body, paddingLeft: '1.4em', listStyle: 'decimal', margin: 0 } as const
const note = { ...body, color: 'var(--color-fg-muted)' } as const

const cell = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--color-border)',
  fontSize: '0.85rem',
  verticalAlign: 'top',
  textAlign: 'left',
} as const

/** 画面の項目と、そこで何ができるか */
const SCREENS = [
  ['🏠 ホーム', '最近の動きと、プロジェクトの数を見る'],
  ['📁 プロジェクト', 'プロジェクトを作る・開く'],
  ['⚙️ 設定', '表示名・見た目・働ける時間帯の設定と、AI の使用量の確認'],
] as const

/** プロジェクトを開いたあとの項目 */
const PROJECT_SCREENS = [
  ['📄 概要', '資料（ファイル）を置く場所。ここにアップロードする'],
  ['✅ タスク', 'やることの一覧。AI に資料から作らせることもできる'],
  ['🗓️ 予定', 'いつ何をするかの計画。AI に組ませることもできる'],
  ['💬 AI チャット', '置いた資料の内容について質問する'],
  ['🕘 変更履歴', '誰がいつ何を変えたかを見る'],
] as const

export default function GuidePage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 650, letterSpacing: '-0.01em' }}>
        TaskMatrix の使い方
      </h1>
      <p style={{ ...note, marginTop: 8 }}>
        はじめての方向けの案内です。専門の知識や、パソコンの準備は必要ありません。
        <br />
        最終更新日: {LAST_UPDATED}
      </p>

      <section style={section}>
        <h2 style={heading}>1. このアプリでできること</h2>
        <p style={body}>
          仕事の資料をまとめて置いておくと、
          <strong>AI がそこから「やること」を洗い出し、いつ手をつけるかまで組み立てます。</strong>
          資料について質問することもできます。
        </p>
        <p style={note}>
          インストール作業は不要です。ふだん使っているブラウザで開くだけで動きます。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>2. 使い始める</h2>
        <ol style={ordered}>
          <li>
            届いた URL を開きます。
          </li>
          <li>
            <strong>「新規登録」</strong>を押します。
          </li>
          <li>
            <strong>招待コード</strong>・メールアドレス・パスワード（8 文字以上）を入れて、
            <strong>「アカウントを作成」</strong>を押します。
          </li>
        </ol>
        <p style={note}>
          招待コードは、このアプリを渡した人から受け取ってください。
          コードが無いと登録はできません。1 つのコードで登録できるのは 1 人だけです。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>3. アイコンから起動できるようにする</h2>
        <p style={body}>
          毎回 URL を開かなくて済むよう、
          <strong>ふつうのアプリと同じようにアイコンから開ける</strong>ようにできます。
          お使いの機器に合わせて、次の操作をしてください。
        </p>

        <h3 style={subheading}>iPhone / iPad（Safari）</h3>
        <p style={body}>
          画面下の<strong>共有ボタン（□に↑）</strong>を押し、
          <strong>「ホーム画面に追加」</strong>を選びます。
        </p>

        <h3 style={subheading}>Android（Chrome）</h3>
        <p style={body}>
          右上の<strong>「︙」</strong>を押し、
          <strong>「ホーム画面に追加」</strong>または<strong>「アプリをインストール」</strong>
          を選びます。
        </p>

        <h3 style={subheading}>Mac（Safari）</h3>
        <p style={body}>
          メニューバーの<strong>「ファイル」→「Dock に追加」</strong>を選びます。
        </p>

        <h3 style={subheading}>Windows / Mac（Chrome・Edge）</h3>
        <p style={body}>
          アドレスバーの右端に出る<strong>インストールの印</strong>を押します。
          見当たらない場合は、右上の<strong>「︙」→「アプリ」→「このサイトをアプリとしてインストール」</strong>
          から進めます。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>4. 画面の見方</h2>
        <p style={body}>左側（せまい画面では上部）に、次の 3 つがあります。</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {SCREENS.map(([name, what]) => (
                <tr key={name}>
                  <td style={{ ...cell, whiteSpace: 'nowrap', fontWeight: 600 }}>{name}</td>
                  <td style={cell}>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ ...body, marginTop: 14 }}>
          プロジェクトを開くと、さらに次の項目が出ます。
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {PROJECT_SCREENS.map(([name, what]) => (
                <tr key={name}>
                  <td style={{ ...cell, whiteSpace: 'nowrap', fontWeight: 600 }}>{name}</td>
                  <td style={cell}>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={section}>
        <h2 style={heading}>5. ひととおりの流れ</h2>
        <ol style={ordered}>
          <li>
            <strong>「プロジェクト」</strong>で、仕事のまとまりを 1 つ作ります。
          </li>
          <li>
            開いた<strong>「概要」</strong>で、資料を<strong>「アップロード」</strong>します。
          </li>
          <li>
            <strong>「AI タスク抽出」</strong>を押すと、資料から「やること」が作られます。
          </li>
          <li>
            <strong>「予定」</strong>で<strong>「スケジュール算出」</strong>を押すと、
            いつ手をつけるかが組まれます。
          </li>
          <li>
            分からないことは<strong>「AI チャット」</strong>で、資料について質問できます。
          </li>
        </ol>
        <p style={note}>
          いつ手をつけるかの計算には、<strong>「設定」</strong>で決めた
          働ける時間帯が使われます。先に設定しておくと、無理のない計画になります。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>6. Google カレンダーとつなぐ（任意）</h2>
        <p style={body}>
          <strong>「予定」</strong>の画面にある<strong>「Google カレンダー連携」</strong>から、
          組んだ予定をふだんお使いの Google カレンダーへ送れます。
        </p>
        <p style={body}>
          途中で<strong>「確認されていないアプリ」</strong>という警告が出ますが、
          これはこのアプリが Google の審査を受けていないためで、故障ではありません。
          <strong>「詳細」→「（アプリ名）に移動」</strong>と進めば続けられます。
        </p>
        <p style={body}>
          <strong>このアプリが触れるのは、このアプリが作ったカレンダーだけです。</strong>
          もともとお使いのカレンダーの予定を、読んだり書き換えたりすることはできません。
        </p>
        <p style={note}>
          連携をやめたあとも、Google 側に作られたカレンダーと予定は残ります。
          不要な場合は Google カレンダーから削除してください。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>7. AI の利用には 1 日の上限があります</h2>
        <p style={body}>
          AI の機能は有料のサービスを使っており、
          <strong>費用はこのアプリを用意した人がまとめて負担しています。</strong>
          そのため、お一人あたり次の上限を設けています。
        </p>
        <ul style={list}>
          <li>
            1 日 <strong>{DAILY_CALL_LIMIT} 回</strong>まで
          </li>
          <li>
            1 日 <strong>{DAILY_TOKEN_LIMIT.toLocaleString('ja-JP')} トークン</strong>まで
            （トークンは、扱った文章の量だとお考えください）
          </li>
        </ul>
        <p style={body}>
          ふだんの使い方で届く量ではありません。
          上限に達した場合は<strong>日本時間の 0 時を過ぎると元に戻ります。</strong>
        </p>
        <p style={note}>
          いまどれだけ使ったかは、<strong>「設定」→「AI の使用量」</strong>で確認できます。
          同じ資料に対して何度も実行すると早く減るので、
          必要なときにお使いください。
        </p>
      </section>

      <section style={section}>
        <h2 style={heading}>8. 困ったとき</h2>
        <ul style={list}>
          <li>
            <strong>登録できない</strong> — 招待コードは 1 人 1 回きりで、
            期限もあります。渡した人に、新しいコードを出してもらってください。
          </li>
          <li>
            <strong>ログインできない</strong> — メールアドレスとパスワードをお確かめください。
            アカウントは登録した本人のものだけが使えます。
          </li>
          <li>
            <strong>AI の処理が終わらない</strong> — 資料が大きいと時間がかかります。
            画面に進み具合と目安の時間が出るので、そのままお待ちください。
          </li>
          <li>
            <strong>AI が「上限に達しました」と出る</strong> — その日の分を使い切っています。
            日本時間の 0 時を過ぎると、また使えるようになります。
          </li>
          <li>
            <strong>画面が古いまま</strong> — アイコンから開いている場合、
            いったん閉じて開き直すと新しくなります。
          </li>
        </ul>
      </section>

      <section style={section}>
        <h2 style={heading}>9. 知っておいていただきたいこと</h2>
        <ul style={list}>
          <li>
            AI の機能を使うと、<strong>資料の内容が Google の AI サービスへ送られます。</strong>
            どの機能で何が送られるかは{' '}
            <Link href="/privacy">プライバシーポリシー</Link> に一覧があります。
          </li>
          <li>
            <strong>自分のデータは自分にしか見えません。</strong>
            他の利用者のプロジェクトや資料が見えることはありません。
          </li>
          <li>
            AI の使った量は<strong>「設定」→「AI の使用量」</strong>で確認できます。
          </li>
          <li>
            <strong>アカウントは「設定」からご自身で削除できます。</strong>
            削除すると保存したものはすべて消え、元には戻せません。
          </li>
        </ul>
      </section>

      <p style={{ marginTop: 36, fontSize: '0.85rem' }}>
        <Link href="/login">ログイン画面へ</Link>
        {' ・ '}
        <Link href="/privacy">プライバシーポリシー</Link>
      </p>
    </main>
  )
}
