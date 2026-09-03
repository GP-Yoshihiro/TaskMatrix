import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import {
  OPERATION_LABEL,
  aggregateByOperation,
  formatDuration,
  formatTokens,
  monthStartIso,
  sumUsage,
} from '@/lib/domain/usage'
import {
  MONTHLY_ROW_CAP,
  createSupabaseAiUsageRepository,
} from '@/lib/repositories/ai-usage'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** 一覧に出す件数 */
const RECENT_LIMIT = 50

const muted = { color: 'var(--color-fg-muted)' }
const cell: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
}
const headerCell: React.CSSProperties = { ...cell, fontWeight: 600, textAlign: 'left' }

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export default async function UsagePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const repository = createSupabaseAiUsageRepository(supabase)
  const [monthly, recent] = await Promise.all([
    repository.listSince(monthStartIso(new Date())),
    repository.listRecent(RECENT_LIMIT),
  ])

  const total = sumUsage(monthly.logs)
  const breakdown = aggregateByOperation(monthly.logs)

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageHeader
        pageLabel="AI の使用量"
        title="AI の使用量"
        description="これまでに使ったトークン量と、処理にかかった時間です。"
        actions={
          <Link href="/settings" style={{ fontSize: '0.85rem' }}>
            設定へ戻る
          </Link>
        }
      />

      {/* 取得できない値を出さない理由を明示する */}
      <Card style={{ display: 'grid', gap: 6 }}>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.7 }}>
          Google は残りトークン量を公開していないため、<strong>残量は表示できません</strong>。
          ここに出るのは実際に使った量です。
        </p>
        <p style={{ fontSize: '0.78rem', ...muted }}>
          失敗した処理も記録します（失敗してもトークンは消費されるため）。
          ただし失敗時は応答が無くトークン数が分からないため 0 と表示されます。
          検索用データの作成は、埋め込み API がトークン数を返さないため文字数で表します。
        </p>
      </Card>

      <section style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ fontWeight: 600 }}>今月の合計</h2>
        {monthly.truncated && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>
            記録が {formatTokens(MONTHLY_ROW_CAP)} 件を超えたため、
            直近 {formatTokens(MONTHLY_ROW_CAP)} 件のみを集計しています。
          </p>
        )}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '0.78rem', ...muted }}>実行回数</p>
            <p style={{ fontSize: '1.3rem', fontWeight: 600 }}>{formatTokens(total.count)}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.78rem', ...muted }}>入力トークン</p>
            <p style={{ fontSize: '1.3rem', fontWeight: 600 }}>
              {formatTokens(total.inputTokens)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.78rem', ...muted }}>出力トークン</p>
            <p style={{ fontSize: '1.3rem', fontWeight: 600 }}>
              {formatTokens(total.outputTokens)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.78rem', ...muted }}>合計</p>
            <p style={{ fontSize: '1.3rem', fontWeight: 600 }}>
              {formatTokens(total.inputTokens + total.outputTokens)}
            </p>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ fontWeight: 600 }}>機能別の内訳（今月）</h2>
        {breakdown.length === 0 ? (
          <p style={{ fontSize: '0.85rem', ...muted }}>今月はまだ AI を使っていません。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={headerCell}>機能</th>
                  <th style={headerCell}>回数</th>
                  <th style={headerCell}>入力</th>
                  <th style={headerCell}>出力</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={row.operation}>
                    <td style={cell}>{OPERATION_LABEL[row.operation]}</td>
                    <td style={cell}>{formatTokens(row.count)}</td>
                    <td style={cell}>{formatTokens(row.inputTokens)}</td>
                    <td style={cell}>{formatTokens(row.outputTokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ fontWeight: 600 }}>直近 {RECENT_LIMIT} 件</h2>
        {recent.length === 0 ? (
          <p style={{ fontSize: '0.85rem', ...muted }}>記録がありません。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={headerCell}>日時</th>
                  <th style={headerCell}>機能</th>
                  <th style={headerCell}>モデル</th>
                  <th style={headerCell}>入力</th>
                  <th style={headerCell}>出力</th>
                  <th style={headerCell}>所要時間</th>
                  <th style={headerCell}>結果</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((log) => (
                  <tr key={log.id}>
                    <td style={cell}>{dateFormatter.format(new Date(log.createdAt))}</td>
                    <td style={cell}>{OPERATION_LABEL[log.operation]}</td>
                    <td style={{ ...cell, ...muted }}>{log.model || '—'}</td>
                    <td style={cell}>
                      {log.inputTokens > 0
                        ? formatTokens(log.inputTokens)
                        : `${formatTokens(log.inputChars)}文字`}
                    </td>
                    <td style={cell}>
                      {log.outputTokens > 0 ? formatTokens(log.outputTokens) : '—'}
                    </td>
                    <td style={cell}>{formatDuration(log.durationMs)}</td>
                    <td style={cell}>
                      {log.status === 'succeeded' ? (
                        '成功'
                      ) : (
                        <span style={{ color: 'var(--color-danger)' }}>
                          失敗{log.errorCode ? `（${log.errorCode}）` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
