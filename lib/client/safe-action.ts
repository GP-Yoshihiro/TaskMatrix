import { type Result, err } from '@/lib/domain/result'

/**
 * Server Action の呼び出しを包み、通信断などの例外を Result に変換する。
 *
 * AI の処理は 20〜30 秒かかることがあり、その間に通信が切れると
 * fetch が例外を投げる。包まずに呼ぶと React のエラーバウンダリが作動し、
 * ページ全体が「問題が発生しました」に置き換わってしまう。
 * 利用者から見れば通信をやり直せばよいだけなので、
 * その場で再試行できるようメッセージとして扱う。
 */
export async function callAction<T>(
  run: () => Promise<Result<T>>,
): Promise<Result<T>> {
  try {
    return await run()
  } catch {
    return err(
      'NETWORK_ERROR',
      '通信に失敗しました。時間をおいてもう一度お試しください。',
    )
  }
}
