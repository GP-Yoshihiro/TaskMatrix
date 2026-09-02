import { describe, expect, it, vi } from 'vitest'
import { MAX_CHUNKS_PER_PROJECT } from '@/lib/domain/chunk'
import { ok } from '@/lib/domain/result'
import type { TextExtractor } from '@/lib/extraction/text'
import type { Embedder } from '@/lib/gemini/embeddings'
import type { ChunkInput, FileChunkRepository } from '@/lib/repositories/file-chunks'
import type { FileVersion, FileVersionRepository } from '@/lib/repositories/file-versions'
import type { FileRepository, ProjectFile } from '@/lib/repositories/files'
import { buildIndexForProject } from '@/lib/usecases/build-index'

const markdownFile: ProjectFile = {
  id: 'f1',
  projectId: 'p1',
  folderId: null,
  name: 'メモ.md',
  kind: 'markdown',
  mimeType: 'text/markdown',
  size: 100,
  storagePath: null,
  currentVersion: 2,
  updatedAt: '2026-08-31T00:00:00Z',
}

const binaryFile: ProjectFile = {
  ...markdownFile,
  id: 'f2',
  name: '資料.pdf',
  kind: 'binary',
  storagePath: 'p1/f2/1/f2.pdf',
}

const version: FileVersion = {
  id: 'v',
  fileId: 'f1',
  version: 2,
  content: '会議メモ。見積もりを来週までに提出する。'.repeat(5),
  storagePath: null,
  size: 100,
  authorId: 'u1',
  note: '',
  createdAt: '',
}

function makeDeps(overrides: { files?: ProjectFile[] } = {}) {
  const files: FileRepository = {
    listByProject: vi.fn(async () => overrides.files ?? [markdownFile]),
    findById: vi.fn(async () => markdownFile),
    create: vi.fn(async () => markdownFile),
    updateForNewVersion: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }

  const versions: FileVersionRepository = {
    findByVersion: vi.fn(async () => version),
    listByFile: vi.fn(async () => []),
    deleteOlderThan: vi.fn(async () => {}),
    create: vi.fn(async () => version),
  }

  const chunks: FileChunkRepository = {
    deleteByFile: vi.fn(async () => {}),
    insertMany: vi.fn(async (inputs: ChunkInput[]) =>
      inputs.map((_input, index) => ({ id: `c${index}` })),
    ),
    updateEmbedding: vi.fn(async () => {}),
    countByProject: vi.fn(async () => 0),
    search: vi.fn(async () => []),
  }

  const embedder: Embedder = {
    embed: vi.fn(async (texts: string[]) =>
      ok({
        vectors: texts.map(() => Array.from({ length: 768 }, () => 0.1)),
        usage: {
          model: 'gemini-embedding-2',
          inputTokens: 0,
          outputTokens: 0,
          inputChars: texts.reduce((total, text) => total + text.length, 0),
        },
      }),
    ),
  }

  const textExtractor: TextExtractor = {
    extract: vi.fn(async () => 'PDF から取り出した本文。'.repeat(10)),
  }

  return {
    files,
    versions,
    chunks,
    embedder,
    textExtractor,
    downloadBinary: vi.fn(async () => new Uint8Array([1, 2, 3])),
  }
}

const input = { projectId: 'p1' }

describe('buildIndexForProject', () => {
  it('markdown は DB の本文を使う', async () => {
    const deps = makeDeps()
    const result = await buildIndexForProject(deps, input)

    expect(result.ok).toBe(true)
    expect(deps.textExtractor.extract).not.toHaveBeenCalled()
    expect(deps.chunks.insertMany).toHaveBeenCalled()
  })

  it('binary は Storage から取り出す', async () => {
    const deps = makeDeps({ files: [binaryFile] })
    await buildIndexForProject(deps, input)

    expect(deps.downloadBinary).toHaveBeenCalledWith('p1/f2/1/f2.pdf')
    expect(deps.textExtractor.extract).toHaveBeenCalled()
  })

  it('作り直す前に古いチャンクを消す', async () => {
    const deps = makeDeps()
    await buildIndexForProject(deps, input)

    expect(deps.chunks.deleteByFile).toHaveBeenCalledWith('f1')
  })

  it('埋め込みを保存する', async () => {
    const deps = makeDeps()
    await buildIndexForProject(deps, input)

    expect(deps.chunks.updateEmbedding).toHaveBeenCalled()
  })

  it('ファイルが 0 件なら NO_INDEXED_CONTENT を返す', async () => {
    const deps = makeDeps({ files: [] })
    const result = await buildIndexForProject(deps, input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NO_INDEXED_CONTENT')
    expect(deps.embedder.embed).not.toHaveBeenCalled()
  })

  it('本文が空のファイルは飛ばす', async () => {
    const deps = makeDeps()
    deps.versions.findByVersion = vi.fn(async () => ({ ...version, content: '   ' }))
    const result = await buildIndexForProject(deps, input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NO_INDEXED_CONTENT')
  })

  it('チャンク数が上限を超えたら埋め込みを呼ばずに拒否する', async () => {
    // 上限を超える件数になるよう、大きなファイルを多数用意する
    const many = Array.from({ length: 60 }, (_, index) => ({
      ...markdownFile,
      id: `f${index}`,
    }))
    const deps = makeDeps({ files: many })
    deps.versions.findByVersion = vi.fn(async () => ({
      ...version,
      content: 'あ'.repeat(8000),
    }))

    const result = await buildIndexForProject(deps, input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TOO_MANY_CHUNKS')
    expect(deps.embedder.embed).not.toHaveBeenCalled()
  })

  it('上限の判定に使う件数が実際のチャンク数と一致する', async () => {
    const deps = makeDeps()
    const result = await buildIndexForProject(deps, input)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const inserted = (deps.chunks.insertMany as ReturnType<typeof vi.fn>).mock.calls
        .flatMap((call) => call[0] as unknown[])
      expect(result.data.chunks).toBe(inserted.length)
    }
  })

  it('埋め込みの件数不一致をそのまま返す', async () => {
    const deps = makeDeps()
    deps.embedder.embed = vi.fn(async () => ({
      ok: false as const,
      error: {
        code: 'EMBEDDING_COUNT_MISMATCH' as const,
        message: '検索用データの作成に失敗しました。',
      },
    }))

    const result = await buildIndexForProject(deps, input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('EMBEDDING_COUNT_MISMATCH')
  })

  it('埋め込みは一定件数ずつに分けて呼ぶ', async () => {
    const deps = makeDeps()
    deps.versions.findByVersion = vi.fn(async () => ({
      ...version,
      content: 'あ'.repeat(40000),
    }))

    await buildIndexForProject(deps, input)

    const calls = (deps.embedder.embed as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.length).toBeGreaterThan(1)
    for (const call of calls) {
      expect((call[0] as string[]).length).toBeLessThanOrEqual(32)
    }
  })
})
