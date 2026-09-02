import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/lib/domain/result'
import type { TextExtractor } from '@/lib/extraction/text'
import type { TaskExtractor } from '@/lib/gemini/client'
import type { ExtractionRunRepository } from '@/lib/repositories/extraction-runs'
import type { FileVersion, FileVersionRepository } from '@/lib/repositories/file-versions'
import type { FileRepository, ProjectFile } from '@/lib/repositories/files'
import { extractTasksFromFile } from '@/lib/usecases/extract-tasks'

const markdownFile: ProjectFile = {
  id: 'f1',
  projectId: 'p1',
  folderId: null,
  name: 'メモ.md',
  kind: 'markdown' as const,
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

const sampleVersion: FileVersion = {
  id: 'v',
  fileId: 'f1',
  version: 2,
  content: '# 会議メモ\n\n- 見積もりを出す。期限は来週まで。担当は未定。'.repeat(10),
  storagePath: null,
  size: 30,
  authorId: 'u1',
  note: '',
  createdAt: '',
}

const aiTask = {
  title: '見積もりを提出する',
  description: '来週までに提出',
  priority: 'high',
  assignee: '',
  due_date: '来週まで',
  ambiguity_note: '「来週」が不明確です。',
  ai_suggestion: '期限を日付で決めてください。',
}

type Deps = {
  files: FileRepository
  versions: FileVersionRepository
  downloadBinary: (storagePath: string) => Promise<Uint8Array>
  textExtractor: TextExtractor
  taskExtractor: TaskExtractor
  runs: ExtractionRunRepository
}

function makeDeps(): Deps {
  const files: FileRepository = {
    findById: vi.fn(async (id: string) =>
      id === 'f2' ? binaryFile : id === 'f1' ? markdownFile : null,
    ),
    listByProject: vi.fn(async () => []),
    create: vi.fn(async () => markdownFile),
    updateForNewVersion: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }

  const versions: FileVersionRepository = {
    findByVersion: vi.fn(async () => sampleVersion),
    listByFile: vi.fn(async () => []),
    deleteOlderThan: vi.fn(async () => {}),
    create: vi.fn(async () => sampleVersion),
  }

  const textExtractor: TextExtractor = {
    extract: vi.fn(async () => 'PDFから抽出したテキストです。'.repeat(20)),
  }

  const taskExtractor: TaskExtractor = {
    extract: vi.fn(async () =>
      ok({
        tasks: [aiTask],
        document_summary: '要約',
        usage: {
          model: 'gemini-3.5-flash',
          inputTokens: 43,
          outputTokens: 290,
          inputChars: 0,
        },
      }),
    ),
  }

  const runs: ExtractionRunRepository = {
    start: vi.fn(async () => ({ id: 'run1' })),
    finish: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
  }

  return {
    files,
    versions,
    downloadBinary: vi.fn(async () => new Uint8Array([1, 2, 3])),
    textExtractor,
    taskExtractor,
    runs,
  }
}

describe('extractTasksFromFile', () => {
  it('markdown は DB の本文を使い、テキスト抽出器を呼ばない', async () => {
    const deps = makeDeps()
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(result.ok).toBe(true)
    expect(deps.textExtractor.extract).not.toHaveBeenCalled()
    expect(deps.taskExtractor.extract).toHaveBeenCalled()
  })

  it('binary は Storage から取得してテキスト抽出器に渡す', async () => {
    const deps = makeDeps()
    await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f2', userId: 'u1' })

    expect(deps.downloadBinary).toHaveBeenCalledWith('p1/f2/1/f2.pdf')
    expect(deps.textExtractor.extract).toHaveBeenCalled()
  })

  it('自然言語の期限を null にして提案に載せる', async () => {
    const deps = makeDeps()
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.suggestions[0].dueDate).toBeNull()
      expect(result.data.suggestions[0].ambiguityNote).toContain('来週')
    }
  })

  it('確定した日付はそのまま保持する', async () => {
    const deps = makeDeps()
    deps.taskExtractor.extract = vi.fn(async () =>
      ok({
        tasks: [{ ...aiTask, due_date: '2026-09-10' }],
        document_summary: '',
        usage: {
          model: 'm',
          inputTokens: 0,
          outputTokens: 0,
          inputChars: 0,
        },
      }),
    )
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.suggestions[0].dueDate).toBe('2026-09-10')
  })

  it('実行記録を開始し、成功で終了させる', async () => {
    const deps = makeDeps()
    await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(deps.runs.start).toHaveBeenCalled()
    expect(deps.runs.finish).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run1', taskCount: 1, model: 'gemini-3.5-flash' }),
    )
    expect(deps.runs.fail).not.toHaveBeenCalled()
  })

  it('存在しないファイルを拒否し、実行記録を作らない', async () => {
    const deps = makeDeps()
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'x', userId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(deps.runs.start).not.toHaveBeenCalled()
  })

  it('抽出テキストが空なら失敗として記録する', async () => {
    const deps = makeDeps()
    deps.versions.findByVersion = vi.fn(async () => null)
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TEXT_EXTRACTION_FAILED')
    expect(deps.runs.fail).toHaveBeenCalled()
    expect(deps.taskExtractor.extract).not.toHaveBeenCalled()
  })

  it('AI が失敗したら失敗として記録する', async () => {
    const deps = makeDeps()
    deps.taskExtractor.extract = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'AI_MODEL_UNAVAILABLE' as const, message: 'AI が混雑しています。' },
    }))
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('AI_MODEL_UNAVAILABLE')
    expect(deps.runs.fail).toHaveBeenCalled()
  })

  it('想定外の優先度は medium に丸める', async () => {
    const deps = makeDeps()
    deps.taskExtractor.extract = vi.fn(async () =>
      ok({
        tasks: [{ ...aiTask, priority: 'urgent' }],
        document_summary: '',
        usage: {
          model: 'm',
          inputTokens: 0,
          outputTokens: 0,
          inputChars: 0,
        },
      }),
    )
    const result = await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f1', userId: 'u1' })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.suggestions[0].priority).toBe('medium')
  })

  it('スキャンPDFと判定したら PDF 本体を送る', async () => {
    const deps = makeDeps()
    deps.textExtractor.extract = vi.fn(async () => 'わずかな文字')
    await extractTasksFromFile(deps, { projectId: 'p1', fileId: 'f2', userId: 'u1' })

    expect(deps.taskExtractor.extract).toHaveBeenCalledWith(
      expect.objectContaining({ pdf: expect.anything() }),
    )
  })
})
