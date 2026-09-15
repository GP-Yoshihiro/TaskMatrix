/**
 * どのモデルを、どの順で試すか。
 *
 * これまでは環境変数の 2 つを並べ、重複を取り除いていた。
 * **両方に同じモデル名が入ると候補が 1 つだけになり、予備が働かなかった。**
 *
 * 実際にそれが起きていた。`GEMINI_MODEL` に遅いモデルを入れると、
 * 予備の既定値と同じ名前になって重複が消え、
 * 遅いモデル 1 つに持ち時間を全部渡して中断していた。
 *
 * ここでは **速いモデルが候補に必ず残ること**を保証する。
 */

/**
 * 速いモデル。
 *
 * 2026-09-14 の実測で、同じ問いに 3〜4 秒で返った。
 */
export const FAST_MODEL = 'gemini-3.5-flash'

/**
 * 予備のモデル。
 *
 * 同じ実測で 47.6 秒 / 115.9 秒かかった。速いモデルが混雑したときの逃げ道。
 */
export const SLOW_MODEL = 'gemini-3.7-flash'

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/**
 * 試す順を決める。
 *
 * 指定があればその順を尊重する。設定を無視すると、
 * なぜ指定したモデルが使われないのかが分からなくなる。
 *
 * ただし **速いモデルが 1 つも無ければ、最後に足す。**
 * 指定より優先はしないが、逃げ道は必ず用意する。
 */
export function resolveModelOrder(
  configured: string | undefined,
  fallback: string | undefined,
): string[] {
  const wanted = [clean(configured), clean(fallback)].filter(
    (model): model is string => model !== null,
  )

  const order = wanted.length === 0 ? [FAST_MODEL, SLOW_MODEL] : wanted

  const unique = order.filter((model, index, all) => all.indexOf(model) === index)

  return unique.includes(FAST_MODEL) ? unique : [...unique, FAST_MODEL]
}
