import { describe, expect, it, vi } from 'vitest'
import type { FileVersion, FileVersionRepository } from '@/lib/repositories/file-versions'
import type { FileRepository, ProjectFile } from '@/lib/repositories/files'
import { saveMarkdown } from '@/lib/usecases/markdown'

const existingFile: ProjectFile = {
  id: 'f1',
  projectId: 'p1',
  folderId: null,
  name: 'メモ.md',
  kind: 'markdown',
  mimeType: 'text/markdown',
  size: 10,
  storagePath: null,
  currentVersion: 2,
  updatedAt: '2026-08-30T00:00:00Z',
}

function makeDeps(file: ProjectFile | null) {
  const files: FileRepository = {
    listByProject: vi.fn(async () => []),
    findById: vi.fn(async () => file),
    create: vi.fn(async () => existingFile),
    updateForNewVersion: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }
  const versions: FileVersionRepository = {
    listByFile: vi.fn(async () => [] as FileVersion[]),
    findByVersion: vi.fn(async () => null),
    create: vi.fn(async (input) => ({
      id: 'v',
      fileId: input.fileId,
      version: input.version,
      content: input.content,
      storagePath: input.storagePath,
      size: input.size,
      authorId: input.authorId,
      note: input.note,
      createdAt: '2026-08-30T00:00:00Z',
    })),
  }
  return { files, versions }
}

describe('saveMarkdown', () => {
  it('現在の版に 1 を足した新しい版を作る', async () => {
    const deps = makeDeps(existingFile)
    const result = await saveMarkdown(deps, {
      fileId: 'f1',
      content: '# 見出し',
      authorId: 'u1',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe(3)
    expect(deps.versions.create).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'f1', version: 3, content: '# 見出し' }),
    )
  })

  it('files の現在バージョンとサイズを更新する', async () => {
    const deps = makeDeps(existingFile)
    await saveMarkdown(deps, { fileId: 'f1', content: 'abc', authorId: 'u1' })

    expect(deps.files.updateForNewVersion).toHaveBeenCalledWith({
      id: 'f1',
      version: 3,
      size: 3,
      storagePath: null,
    })
  })

  it('存在しないファイルを拒否する', async () => {
    const deps = makeDeps(null)
    const result = await saveMarkdown(deps, { fileId: 'x', content: 'a', authorId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
    expect(deps.versions.create).not.toHaveBeenCalled()
  })

  it('binary ファイルの本文保存を拒否する', async () => {
    const deps = makeDeps({ ...existingFile, kind: 'binary' })
    const result = await saveMarkdown(deps, { fileId: 'f1', content: 'a', authorId: 'u1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(deps.versions.create).not.toHaveBeenCalled()
  })

  it('マルチバイト文字をバイト長で数える', async () => {
    const deps = makeDeps(existingFile)
    await saveMarkdown(deps, { fileId: 'f1', content: 'あ', authorId: 'u1' })

    expect(deps.files.updateForNewVersion).toHaveBeenCalledWith(
      expect.objectContaining({ size: 3 }),
    )
  })
})
