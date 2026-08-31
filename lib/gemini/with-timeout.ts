export class TimeoutError extends Error {
  constructor(milliseconds: number) {
    super(`処理が ${milliseconds} ミリ秒以内に完了しませんでした。`)
    this.name = 'TimeoutError'
  }
}

/**
 * 一定時間で打ち切る。
 *
 * Gemini の応答が返らないまま固まると、画面が「処理中…」のまま
 * 復帰できなくなる。実際に 4 分以上応答しない事象が起きたため、
 * 呼び出し側で必ず打ち切るようにする。
 */
export function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(milliseconds)), milliseconds)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}
