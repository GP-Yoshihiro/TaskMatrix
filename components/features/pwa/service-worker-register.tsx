'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Service Worker を登録し、更新を検知したら再読み込みを案内する。
 *
 * 自動で再読み込みはしない。入力中の内容が失われるおそれがあるため、
 * 利用者が押したときだけ再読み込みする。
 */
export function ServiceWorkerRegister() {
  const [updated, setUpdated] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 登録できなくてもアプリは通常どおり動く
    })

    // 初回に制御を得るのは「更新」ではない
    let isFirstControl = navigator.serviceWorker.controller === null

    function handleControllerChange() {
      if (isFirstControl) {
        isFirstControl = false
        return
      }
      setUpdated(true)
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  if (!updated) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        insetInline: 16,
        bottom: 16,
        zIndex: 60,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        padding: 12,
      }}
    >
      <span style={{ fontSize: '0.85rem' }}>新しい版があります。</span>
      <Button size="sm" onClick={() => window.location.reload()}>
        再読み込み
      </Button>
    </div>
  )
}
