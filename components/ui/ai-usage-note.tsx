import { type AiUsage, summarizeUsage } from '@/lib/domain/usage'

type Props = {
  usage: AiUsage
  durationMs: number
}

/**
 * 処理直後に出す使用量の 1 行。
 * 成功の知らせなので role="status" とし、エラーと同じ見た目にしない。
 */
export function AiUsageNote({ usage, durationMs }: Props) {
  return (
    <p
      role="status"
      style={{ fontSize: '0.78rem', color: 'var(--color-fg-muted)' }}
    >
      {summarizeUsage(usage, durationMs)}
    </p>
  )
}
