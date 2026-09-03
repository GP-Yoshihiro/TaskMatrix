'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useCallback, useState, useSyncExternalStore } from 'react'
import { type SidebarProject, Sidebar } from '@/components/layout/sidebar'
import { LogoutButton } from '@/components/features/auth/logout-button'
import { projectIdFromPath } from '@/lib/domain/navigation'
import {
  getServerSnapshot,
  getSnapshot,
  setCollapsed,
  subscribe,
} from '@/lib/client/sidebar-store'

const SIDEBAR_WIDTH = 240

/** これより狭い画面では、サイドバーを本文に覆い被せる */
const NARROW_WIDTH = 860

/** 本文の最大幅。広い画面で行が長くなりすぎると読みにくい */
const CONTENT_MAX_WIDTH = 1180

function subscribeToResize(callback: () => void) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

/**
 * アプリの骨格。
 *
 * 左に移動先、右に本文を置く。サイドバーは**どの画面幅でも閉じられる**。
 * 閉じた状態は記憶し、次回以降も保つ。
 */
export function AppShell({
  projects,
  children,
}: {
  projects: SidebarProject[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const projectId = projectIdFromPath(pathname)

  // 画面幅は外の状態なので、状態管理の仕組みで直接読む
  const narrow = useSyncExternalStore(
    subscribeToResize,
    () => window.innerWidth < NARROW_WIDTH,
    () => false,
  )

  // 広い画面での好みは記憶する。保存と表示が食い違わないよう外の状態として読む
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  /**
   * 狭い画面での開閉は記憶しない。
   *
   * 狭い画面では移動のたびに自動で閉じるが、これは「一時的にどく」動作であり
   * 利用者の好みではない。記憶してしまうと、広い画面に戻ったときに
   * 自分で閉じた覚えのないサイドバーが閉じたままになる。
   */
  const [narrowOpen, setNarrowOpen] = useState(false)

  const open = narrow ? narrowOpen : !collapsed

  const toggle = useCallback(() => {
    if (narrow) setNarrowOpen((current) => !current)
    else setCollapsed(!collapsed)
  }, [narrow, collapsed])

  // 狭い画面では覆い被せる。広い画面では本文を押し出す
  const overlay = narrow && open

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? '移動先を閉じる' : '移動先を開く'}
          aria-expanded={open}
          style={{
            display: 'grid',
            gap: 3,
            padding: 8,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          {[0, 1, 2].map((line) => (
            <span
              key={line}
              aria-hidden
              style={{
                display: 'block',
                width: 16,
                height: 2,
                borderRadius: 1,
                background: 'var(--color-fg)',
              }}
            />
          ))}
        </button>

        <Link
          href="/dashboard"
          style={{ fontWeight: 600, textDecoration: 'none', color: 'var(--color-fg)' }}
        >
          TaskMatrix
        </Link>

        <div style={{ marginInlineStart: 'auto' }}>
          <LogoutButton />
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: open && !narrow ? `${SIDEBAR_WIDTH}px 1fr` : '1fr',
          position: 'relative',
          minHeight: 0,
        }}
      >
        {open && (
          <>
            {/* 狭い画面では、外を押して閉じられるようにする */}
            {overlay && (
              <button
                type="button"
                aria-label="移動先を閉じる"
                onClick={toggle}
                style={{
                  position: 'fixed',
                  inset: 0,
                  top: 52,
                  zIndex: 20,
                  border: 'none',
                  background: 'rgb(0 0 0 / 0.3)',
                  cursor: 'pointer',
                }}
              />
            )}

            <aside
              style={{
                background: 'var(--color-surface)',
                borderInlineEnd: '1px solid var(--color-border)',
                ...(overlay
                  ? {
                      position: 'fixed',
                      insetInlineStart: 0,
                      top: 52,
                      bottom: 0,
                      width: SIDEBAR_WIDTH,
                      zIndex: 25,
                    }
                  : { position: 'sticky', top: 52, alignSelf: 'start', height: 'calc(100dvh - 52px)' }),
              }}
            >
              <Sidebar
                pathname={pathname}
                projectId={projectId}
                projects={projects}
                onNavigate={() => {
                  // 狭い画面では移動と同時に閉じ、本文を隠さない。
                  // 記憶には触れない（好みではなく一時的な動作のため）
                  if (narrow) setNarrowOpen(false)
                }}
              />
            </aside>
          </>
        )}

        <main style={{ padding: '24px 20px', minWidth: 0 }}>
          {/* 中央寄せにして、広い画面で右が大きく空くのを防ぐ */}
          <div style={{ maxWidth: CONTENT_MAX_WIDTH, margin: '0 auto', minWidth: 0 }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
