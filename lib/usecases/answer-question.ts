import { type Result, err, ok } from '@/lib/domain/result'
import type { AiUsage } from '@/lib/domain/usage'
import { buildExcerpt, trimHistory } from '@/lib/domain/rag'
import type { QuestionAnswerer } from '@/lib/gemini/answer-question'
import type { Embedder } from '@/lib/gemini/embeddings'
import type { ChatRepository, ChatSource } from '@/lib/repositories/chat'
import type { FileChunkRepository } from '@/lib/repositories/file-chunks'
import type { FileRepository } from '@/lib/repositories/files'

/** 回答の根拠として渡すチャンクの数 */
const MATCH_COUNT = 8

type Deps = {
  chunks: FileChunkRepository
  files: FileRepository
  chat: ChatRepository
  embedder: Embedder
  answerer: QuestionAnswerer
}

/**
 * 質問に対し、プロジェクト内の資料を根拠に回答する。
 *
 * 近傍が 0 件なら AI を呼ばない。根拠が無いまま答えさせると、
 * それらしい創作を返してしまうため。
 */
export async function answerQuestion(
  deps: Deps,
  input: { projectId: string; userId: string; question: string },
): Promise<Result<{ answer: string; sources: ChatSource[]; usage: AiUsage }>> {
  const question = input.question.trim()
  if (question.length === 0) {
    return err('VALIDATION_ERROR', '質問を入力してください。')
  }

  const embedded = await deps.embedder.embed([question])
  if (!embedded.ok) return embedded

  const matches = await deps.chunks.search({
    projectId: input.projectId,
    embedding: embedded.data.vectors[0],
    limit: MATCH_COUNT,
  })

  if (matches.length === 0) {
    return err(
      'NO_INDEXED_CONTENT',
      '検索用データがありません。先に「検索用データを作成」を実行してください。',
    )
  }

  // 根拠に出すファイル名を引く
  const fileIds = [...new Set(matches.map((match) => match.fileId))]
  const names = new Map<string, string>()
  for (const fileId of fileIds) {
    const file = await deps.files.findById(fileId)
    names.set(fileId, file?.name ?? '(削除されたファイル)')
  }

  const sources: ChatSource[] = matches.map((match) => ({
    fileId: match.fileId,
    fileName: names.get(match.fileId) ?? '',
    chunkIndex: match.chunkIndex,
    excerpt: buildExcerpt(match.content),
  }))

  const session = await deps.chat.findOrCreateSession({
    projectId: input.projectId,
    userId: input.userId,
  })

  const history = trimHistory(await deps.chat.listMessages(session.id))

  const answered = await deps.answerer.answer({
    question,
    excerpts: matches.map((match) => ({
      fileName: names.get(match.fileId) ?? '',
      content: match.content,
    })),
    history: history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  })
  if (!answered.ok) return answered

  await deps.chat.addMessage({
    sessionId: session.id,
    role: 'user',
    content: question,
    sources: [],
  })
  await deps.chat.addMessage({
    sessionId: session.id,
    role: 'assistant',
    content: answered.data.text,
    sources,
  })

  // 質問の埋め込みはトークンを返さないため、文字数だけを合算する
  const usage: AiUsage = {
    ...answered.data.usage,
    inputChars: answered.data.usage.inputChars + embedded.data.usage.inputChars,
  }

  return ok({ answer: answered.data.text, sources, usage })
}
