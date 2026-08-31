import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/lib/domain/result'
import type { Embedder } from '@/lib/gemini/embeddings'
import type { QuestionAnswerer } from '@/lib/gemini/answer-question'
import type { ChatMessage, ChatRepository } from '@/lib/repositories/chat'
import type { FileChunkRepository, MatchedChunk } from '@/lib/repositories/file-chunks'
import type { FileRepository, ProjectFile } from '@/lib/repositories/files'
import { answerQuestion } from '@/lib/usecases/answer-question'

const file: ProjectFile = {
  id: 'f1',
  projectId: 'p1',
  folderId: null,
  name: '要件メモ.md',
  kind: 'markdown',
  mimeType: 'text/markdown',
  size: 10,
  storagePath: null,
  currentVersion: 1,
  updatedAt: '',
}

function chunk(id: string, content: string): MatchedChunk {
  return { id, fileId: 'f1', chunkIndex: 0, content, similarity: 0.9 }
}

function makeDeps(overrides: { matches?: MatchedChunk[]; history?: ChatMessage[] } = {}) {
  const chunks: FileChunkRepository = {
    deleteByFile: vi.fn(async () => {}),
    insertMany: vi.fn(async () => []),
    updateEmbedding: vi.fn(async () => {}),
    countByProject: vi.fn(async () => 5),
    search: vi.fn(async () => overrides.matches ?? [chunk('c1', '見積もりは来週までに提出する。')]),
  }

  const files: FileRepository = {
    listByProject: vi.fn(async () => [file]),
    findById: vi.fn(async () => file),
    create: vi.fn(async () => file),
    updateForNewVersion: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }

  const chat: ChatRepository = {
    findOrCreateSession: vi.fn(async () => ({ id: 's1' })),
    listMessages: vi.fn(async () => overrides.history ?? []),
    addMessage: vi.fn(async () => {}),
  }

  const embedder: Embedder = {
    embed: vi.fn(async () =>
      ok({
        vectors: [Array.from({ length: 768 }, () => 0.1)],
        usage: { model: 'gemini-embedding-2', inputTokens: 0, outputTokens: 0, inputChars: 12 },
      }),
    ),
  }

  const answerer: QuestionAnswerer = {
    answer: vi.fn(async () =>
      ok({
        text: '要件メモ.md によると、来週までに提出します。',
        usage: {
          model: 'gemini-3.5-flash',
          inputTokens: 900,
          outputTokens: 120,
          inputChars: 3000,
        },
      }),
    ),
  }

  return { chunks, files, chat, embedder, answerer }
}

const input = { projectId: 'p1', userId: 'u1', question: '見積もりの期限は？' }

describe('answerQuestion', () => {
  it('質問を埋め込みに変換して近傍検索する', async () => {
    const deps = makeDeps()
    const result = await answerQuestion(deps, input)

    expect(result.ok).toBe(true)
    expect(deps.embedder.embed).toHaveBeenCalledWith(['見積もりの期限は？'])
    expect(deps.chunks.search).toHaveBeenCalled()
  })

  it('根拠にファイル名と抜粋を含める', async () => {
    const deps = makeDeps()
    const result = await answerQuestion(deps, input)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.sources).toHaveLength(1)
      expect(result.data.sources[0].fileName).toBe('要件メモ.md')
      expect(result.data.sources[0].excerpt).toContain('見積もり')
    }
  })

  it('近傍が 0 件なら AI を呼ばずに案内する', async () => {
    const deps = makeDeps({ matches: [] })
    const result = await answerQuestion(deps, input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NO_INDEXED_CONTENT')
    expect(deps.answerer.answer).not.toHaveBeenCalled()
  })

  it('埋め込みが失敗したら AI を呼ばない', async () => {
    const deps = makeDeps()
    deps.embedder.embed = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'AI_REQUEST_FAILED' as const, message: '失敗' },
    }))

    const result = await answerQuestion(deps, input)
    expect(result.ok).toBe(false)
    expect(deps.answerer.answer).not.toHaveBeenCalled()
  })

  it('質問と回答の両方を保存する', async () => {
    const deps = makeDeps()
    await answerQuestion(deps, input)

    const calls = (deps.chat.addMessage as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0][0].role).toBe('user')
    expect(calls[1][0].role).toBe('assistant')
  })

  it('空の質問を拒否する', async () => {
    const deps = makeDeps()
    const result = await answerQuestion(deps, { ...input, question: '   ' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(deps.embedder.embed).not.toHaveBeenCalled()
  })

  it('直近の会話を切り詰めて渡す', async () => {
    const history: ChatMessage[] = Array.from({ length: 40 }, (_, index) => ({
      id: `m${index}`,
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `発言${index}`,
      sources: [],
      createdAt: '',
    }))
    const deps = makeDeps({ history })
    await answerQuestion(deps, input)

    const passed = (deps.answerer.answer as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(passed.history.length).toBeLessThanOrEqual(12)
  })

  it('同じファイルの複数チャンクをすべて根拠に載せる', async () => {
    const deps = makeDeps({
      matches: [chunk('c1', '一つ目の記述'), chunk('c2', '二つ目の記述')],
    })
    const result = await answerQuestion(deps, input)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.sources).toHaveLength(2)
  })
})
