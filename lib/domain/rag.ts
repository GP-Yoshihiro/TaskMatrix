/** 根拠として画面に出す抜粋の長さ */
export const EXCERPT_LENGTH = 160

/** Gemini に渡す直近のやり取りの数（1 往復 = 2 件） */
export const MAX_HISTORY_TURNS = 6

/** 根拠として表示する抜粋を作る。1 行に均して読みやすくする */
export function buildExcerpt(content: string, maxLength = EXCERPT_LENGTH): string {
  const flattened = content.replace(/\s+/g, ' ').trim()
  if (flattened.length <= maxLength) return flattened
  return `${flattened.slice(0, maxLength)}…`
}

/** 直近のやり取りだけを残す。元の配列は書き換えない */
export function trimHistory<T>(messages: T[], maxTurns = MAX_HISTORY_TURNS): T[] {
  const limit = maxTurns * 2
  return messages.length <= limit ? [...messages] : messages.slice(-limit)
}

export type PromptExcerpt = { fileName: string; content: string }
export type PromptMessage = { role: 'user' | 'assistant'; content: string }

/**
 * 回答用のプロンプトを組み立てる。
 *
 * 根拠に無いことを答えさせないのが要点。
 * 推測で答えると、利用者は資料に書いてあると誤解してしまう。
 */
export function buildAnswerPrompt(input: {
  question: string
  excerpts: PromptExcerpt[]
  history: PromptMessage[]
}): string {
  const excerpts =
    input.excerpts.length === 0
      ? 'なし'
      : input.excerpts
          .map((item, index) => `【資料${index + 1}】${item.fileName}\n${item.content}`)
          .join('\n\n')

  const history =
    input.history.length === 0
      ? 'なし'
      : input.history
          .map((message) => `${message.role === 'user' ? '利用者' : 'あなた'}: ${message.content}`)
          .join('\n')

  return `あなたはプロジェクトの資料に詳しい担当者です。
以下の資料だけを根拠にして、利用者の質問に答えてください。

回答の決まり:
- すべて日本語で答えてください。
- **資料に書かれていないことは「資料からは分かりません」と答えてください。**
- 推測で補わないでください。ありそうな内容を創作してはいけません。
- どの資料に基づくかが分かるよう、ファイル名に触れて答えてください。
- 簡潔に、要点から書いてください。

これまでの会話:
${history}

資料:
${excerpts}

利用者の質問:
${input.question}`
}
