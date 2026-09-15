/**
 * 思考の深さを指定して呼ぶ。
 *
 * Gemini 3 系は既定で深く考える。スケジュールの割り付けのように
 * **手順が決まっていて、出力量のほうが時間を支配する**処理では、
 * 深い思考はそのまま待ち時間になる。
 *
 * ただし、この指定に対応しないモデルは誤りを返す。
 * 2026-09-15 時点では利用上限に達していて実地で確かめられないため、
 * **拒まれたら指定なしでもう一度呼ぶ。**
 * 指定が通らないせいで機能ごと止まる、という事態を避ける。
 */

/** 送り方が悪いという返事か。モデルを変えても同じなので、指定を外して試す */
function isInvalidArgument(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 429
}

export async function withThinkingLevel<P extends object, R>(
  create: (params: P & { generation_config?: { thinking_level: string } }) => Promise<R>,
  params: P,
  thinkingLevel: string,
): Promise<R> {
  try {
    return await create({ ...params, generation_config: { thinking_level: thinkingLevel } })
  } catch (error) {
    if (!isInvalidArgument(error)) throw error
    // 指定が通らないだけ。指定を外してやり直す
    return await create(params)
  }
}
