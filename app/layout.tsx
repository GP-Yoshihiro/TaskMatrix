import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'
import type { ReactNode } from 'react'
import { ServiceWorkerRegister } from '@/components/features/pwa/service-worker-register'
import {
  THEME_COOKIE_NAME,
  type ThemePreference,
  resolveTheme,
} from '@/lib/platform/theme'
import './globals.css'

export const metadata: Metadata = {
  title: 'TaskMatrix',
  description: 'フォルダ・タスク・スケジュール管理アプリケーション',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'TaskMatrix',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  other: {
    // Next.js は標準の mobile-web-app-capable を出力する。
    // 古い iOS はこちらしか解釈しないため、互換性のため併記する。
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: '#0071e3',
  width: 'device-width',
  initialScale: 1,
  // iPhone のノッチ領域まで背景を広げる
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const cookieStore = await cookies()
  const headerList = await headers()

  const preference =
    (cookieStore.get(THEME_COOKIE_NAME)?.value as ThemePreference | undefined) ??
    'auto'
  const platform = resolveTheme(preference, headerList.get('user-agent') ?? '')

  return (
    <html lang="ja" data-platform={platform}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
