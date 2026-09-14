import { z } from 'zod'
import { type Result, err, ok } from '@/lib/domain/result'

/**
 * 抽出したタスクのうち、同じ作業を指すものを見つける。
 *
 * 表記が違っても同じ作業ならまとめたい、という判断による。
 * ただし**別の作業を誤ってまとめる危険**があるため、
 * ここでは組分けを返すだけにし、**適用するかは利用者が画面で決める**。
 */

/** 判定に渡す 1 件分。本文は送らない。題と説明があれば足りる */
export type DuplicateCandidate = {
  key: string
  title: string
  description: string
}

export const DUPLICATE_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      description: '同じ作業を指すものの組。2 件以上のときだけ入れる',
      items: {
        type: 'array',
        items: { type: 'string', description: '入力で渡した key' },
      },
    },
  },
  required: ['groups'],
} as const

export function buildDuplicatePrompt(candidates: DuplicateCandidate[]): string {
  const list = candidates
    .map((item) => `- key: ${item.key}\n  title: ${item.title}\n  description: ${item.description}`)
    .join('\n')

  return `次のタスク一覧から、**同じ作業を指しているもの**を組にしてください。

判断の決まり:
- 表現が違っても、**実際に行う作業が同じ**なら同じ組にしてください。
  例: 「見積もりを提出する」と「見積書を先方へ送付」は同じ組。
- **似ているだけで別の作業**なら、組にしないでください。
  例: 「議事録を作成する」と「議事録を確認する」は別の作業です。
  例: 対象や相手が違うもの（A社への提出 と B社への提出）は別の作業です。
- 迷った場合は**組にしないでください。** まとめすぎると、別の作業が消えます。
- 組は 2 件以上のときだけ作ってください。1 件だけの組は入れないでください。
- 同じ key を 2 つ以上の組に入れないでください。
- 同じ作業が無ければ groups を空配列にしてください。

タスク一覧:
${list}`
}

const responseSchema = z.object({
  groups: z.array(z.array(z.string())),
})

/** 応答から組分けを取り出す。壊れていれば「組分け無し」として扱う */
export function parseDuplicateResponse(raw: unknown): Result<string[][]> {
  const parsed = responseSchema.safeParse(raw)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', '重複の判定結果を解釈できませんでした。')
  }

  // 1 件だけの組は意味が無いので落とす
  return ok(parsed.data.groups.filter((group) => group.length >= 2))
}
