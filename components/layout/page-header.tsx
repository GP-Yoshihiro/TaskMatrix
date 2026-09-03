import Link from 'next/link'
import type { ReactNode } from 'react'
import { type Crumb, buildBreadcrumbs } from '@/lib/domain/navigation'

/**
 * 画面の見出し。
 *
 * パンくず・題名・その画面の操作を 1 か所にまとめる。
 * 画面ごとに見出しの作りが違うと、目の置き所が定まらない。
 */
export function PageHeader({
  projectId = null,
  projectName = null,
  pageLabel = null,
  title,
  description,
  actions,
}: {
  projectId?: string | null
  projectName?: string | null
  /** パンくずの最後に出す名前 */
  pageLabel?: string | null
  title: string
  description?: string
  /** 右側に置く操作。無ければ省略 */
  actions?: ReactNode
}) {
  const crumbs: Crumb[] = buildBreadcrumbs({ projectId, projectName, pageLabel })

  return (
    <header style={{ display: 'grid', gap: 6, marginBottom: 20 }}>
      {crumbs.length > 0 && (
        <nav aria-label="現在の場所">
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              fontSize: '0.78rem',
              color: 'var(--color-fg-muted)',
            }}
          >
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} style={{ display: 'flex', gap: 6 }}>
                {index > 0 && <span aria-hidden>/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} style={{ color: 'inherit' }}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontSize: '1.45rem', fontWeight: 650, letterSpacing: '-0.01em' }}>
          {title}
        </h1>
        {actions && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
      </div>

      {description && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-muted)', lineHeight: 1.6 }}>
          {description}
        </p>
      )}
    </header>
  )
}
