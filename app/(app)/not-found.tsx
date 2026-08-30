import Link from 'next/link'
import { Card } from '@/components/ui/card'

export default function AppNotFound() {
  return (
    <Card style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
      <h2 style={{ fontWeight: 600 }}>お探しのページは見つかりません</h2>
      <Link href="/dashboard">ホームへ戻る</Link>
    </Card>
  )
}
