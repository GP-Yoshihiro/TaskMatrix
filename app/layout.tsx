import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import type { ReactNode } from 'react'
import {
  THEME_COOKIE_NAME,
  type ThemePreference,
  resolveTheme,
} from '@/lib/platform/theme'
import './globals.css'

export const metadata: Metadata = {
  title: 'TaskMatrix',
  description: 'フォルダ・タスク・スケジュール管理アプリケーション',
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
      <body>{children}</body>
    </html>
  )
}
