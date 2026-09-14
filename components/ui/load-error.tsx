import { Card } from '@/components/ui/card'

/**
 * 一部の情報を読めなかったときの知らせ。
 *
 * 画面ごと落とさず、読めなかったことだけを伝える。
 * 真っ白な画面では、故障なのか権限なのか、何も手掛かりが残らない。
 *
 * 原因の詳細は出さない。利用者に打てる手が無く、
 * 表の構造を画面に晒すことにもなるため。
 */
export function LoadError({ what }: { what?: string }) {
  return (
    <Card
      role="status"
      style={{ display: 'grid', gap: 6, borderColor: 'var(--color-danger)' }}
    >
      <strong style={{ fontSize: '0.9rem', color: 'var(--color-danger)' }}>
        {what ? `${what}を読み込めませんでした` : '一部の情報を読み込めませんでした'}
      </strong>
      <p style={{ fontSize: '0.82rem', lineHeight: 1.7, color: 'var(--color-fg-muted)' }}>
        時間をおいて開き直してください。
        繰り返す場合は、運用者にこの画面の名前をお知らせください。
      </p>
    </Card>
  )
}
