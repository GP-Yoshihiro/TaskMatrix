import { Card } from '@/components/ui/card'

export const metadata = { title: 'オフライン - TaskMatrix' }

/**
 * オフライン時に Service Worker が返すページ。
 * キャッシュ対象なので Supabase に依存してはならない。
 * 認証チェックも行わないため (app) グループの外に置いている。
 */
export default function OfflinePage() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 16 }}>
      <Card style={{ display: 'grid', gap: 12, maxWidth: 420, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 600 }}>オフラインです</h1>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>
          インターネット接続をご確認ください。
          接続が戻ると、そのままご利用いただけます。
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-fg-muted)' }}>
          オフライン中はタスクや予定を表示できません。
        </p>
      </Card>
    </div>
  )
}
