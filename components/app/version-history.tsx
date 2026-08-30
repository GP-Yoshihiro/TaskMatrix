'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { type DiffLine, diffLines } from '@/lib/domain/diff'
import type { FileVersion } from '@/lib/repositories/file-versions'

const LINE_STYLE: Record<DiffLine['type'], CSSProperties> = {
  added: { background: 'rgb(52 199 89 / 0.16)' },
  removed: { background: 'rgb(255 69 58 / 0.16)' },
  unchanged: {},
}

const PREFIX: Record<DiffLine['type'], string> = {
  added: '+ ',
  removed: '- ',
  unchanged: '  ',
}

export function VersionHistory({
  versions,
  isTextFile,
}: {
  versions: FileVersion[]
  isTextFile: boolean
}) {
  const [selected, setSelected] = useState<number>(versions[0]?.version ?? 1)

  const diff = useMemo(() => {
    if (!isTextFile) return []
    const current = versions.find((version) => version.version === selected)
    const previous = versions.find((version) => version.version === selected - 1)
    return diffLines(previous?.content ?? '', current?.content ?? '')
  }, [isTextFile, selected, versions])

  if (versions.length === 0) {
    return <p style={{ color: 'var(--color-fg-muted)' }}>履歴がまだありません。</p>
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        alignItems: 'start',
      }}
    >
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8, alignContent: 'start' }}>
        {versions.map((version) => (
          <li key={version.id}>
            <button
              onClick={() => setSelected(version.version)}
              style={{
                width: '100%',
                textAlign: 'left',
                background:
                  version.version === selected ? 'var(--color-accent)' : 'var(--color-surface)',
                color:
                  version.version === selected ? 'var(--color-accent-fg)' : 'var(--color-fg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 10,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600 }}>
                v{version.version}（{version.note}）
              </div>
              <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                {new Date(version.createdAt).toLocaleString('ja-JP')} / {version.size} バイト
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Card style={{ overflow: 'auto', gridColumn: 'span 2' }}>
        {!isTextFile ? (
          <p style={{ color: 'var(--color-fg-muted)' }}>
            この形式は差分表示に対応していません。版ごとの記録のみ保持しています。
          </p>
        ) : diff.length === 0 ? (
          <p style={{ color: 'var(--color-fg-muted)' }}>この版に変更はありません。</p>
        ) : (
          <pre
            data-testid="diff"
            style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}
          >
            {diff.map((line, index) => (
              <div key={index} data-diff={line.type} style={LINE_STYLE[line.type]}>
                {PREFIX[line.type]}
                {line.value}
              </div>
            ))}
          </pre>
        )}
      </Card>
    </div>
  )
}
