'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  GLOBAL_NAV,
  PROJECT_NAV,
  type NavItem,
  isActive,
  resolveHref,
} from '@/lib/domain/navigation'

export type SidebarProject = { id: string; name: string }

const sectionLabel = {
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  color: 'var(--color-fg-muted)',
  padding: '0 12px',
  marginBottom: 4,
} as const

/** 移動先 1 つ分。現在地は背景で示す */
function NavLink({
  item,
  pathname,
  projectId,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  projectId: string | null
  onNavigate: () => void
}) {
  const href = resolveHref(item.href, projectId)
  const active = isActive(pathname, href)

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className="tm-nav-link"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.88rem',
        textDecoration: 'none',
        color: active ? 'var(--color-accent)' : 'var(--color-fg)',
        fontWeight: active ? 600 : 400,
        background: active
          ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
          : 'transparent',
      }}
    >
      <span aria-hidden style={{ fontSize: '0.95rem', lineHeight: 1 }}>
        {item.icon}
      </span>
      {item.label}
    </Link>
  )
}

/**
 * 移動先の一覧。
 *
 * 現在地をハイライトし、プロジェクトを開いている間はその項目も出す。
 * 上部からは一覧へ戻らずにプロジェクトを切り替えられる。
 */
export function Sidebar({
  pathname,
  projectId,
  projects,
  onNavigate,
}: {
  pathname: string
  projectId: string | null
  projects: SidebarProject[]
  /** 狭い画面では移動と同時に閉じる */
  onNavigate: () => void
}) {
  const [switching, setSwitching] = useState(false)

  const current = projects.find((project) => project.id === projectId) ?? null

  return (
    <nav
      aria-label="主要な移動先"
      style={{
        display: 'grid',
        alignContent: 'start',
        gap: 18,
        padding: '16px 8px',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* 現在のプロジェクトと切替 */}
      {current && (
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={sectionLabel}>プロジェクト</span>
          <button
            type="button"
            onClick={() => setSwitching((open) => !open)}
            aria-expanded={switching}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-fg)',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: '0.9rem',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {current.name}
            </span>
            <span aria-hidden style={{ color: 'var(--color-fg-muted)' }}>
              {switching ? '▴' : '▾'}
            </span>
          </button>

          {/* 一覧へ戻らずに切り替えられるようにする */}
          {switching && (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 2 }}>
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    onClick={() => {
                      setSwitching(false)
                      onNavigate()
                    }}
                    className="tm-nav-link"
                    style={{
                      display: 'block',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      textDecoration: 'none',
                      color:
                        project.id === projectId
                          ? 'var(--color-accent)'
                          : 'var(--color-fg)',
                      background:
                        project.id === projectId
                          ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
                          : 'transparent',
                    }}
                  >
                    {project.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* プロジェクト内の移動先。本文に埋もれていたリンクをここへ集約する */}
      {projectId && (
        <div style={{ display: 'grid', gap: 2 }}>
          <span style={sectionLabel}>このプロジェクト</span>
          {PROJECT_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              projectId={projectId}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gap: 2 }}>
        <span style={sectionLabel}>全体</span>
        {GLOBAL_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            projectId={null}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  )
}
