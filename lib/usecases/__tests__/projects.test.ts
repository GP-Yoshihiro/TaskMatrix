import { describe, expect, it, vi } from 'vitest'
import { createProject } from '@/lib/usecases/projects'
import type { Project, ProjectRepository } from '@/lib/repositories/projects'

const sampleProject: Project = {
  id: 'p1',
  ownerId: 'u1',
  name: '新規プロジェクト',
  description: '',
  createdAt: '2026-08-30T00:00:00Z',
  updatedAt: '2026-08-30T00:00:00Z',
}

function makeRepo(count: number): ProjectRepository {
  return {
    listByOwner: vi.fn(async () => []),
    countByOwner: vi.fn(async () => count),
    create: vi.fn(async () => sampleProject),
    rename: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }
}

describe('createProject', () => {
  it('上限未満なら作成する', async () => {
    const repo = makeRepo(19)
    const result = await createProject(repo, 'u1', '新規プロジェクト')
    expect(result.ok).toBe(true)
    expect(repo.create).toHaveBeenCalledWith({ ownerId: 'u1', name: '新規プロジェクト' })
  })

  it('20 件に達していたら拒否し、作成を呼ばない', async () => {
    const repo = makeRepo(20)
    const result = await createProject(repo, 'u1', '新規プロジェクト')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PROJECT_LIMIT_EXCEEDED')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('空の名前を拒否し、作成を呼ばない', async () => {
    const repo = makeRepo(0)
    const result = await createProject(repo, 'u1', '   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('名前の前後の空白を取り除いて渡す', async () => {
    const repo = makeRepo(0)
    await createProject(repo, 'u1', '  設計資料  ')
    expect(repo.create).toHaveBeenCalledWith({ ownerId: 'u1', name: '設計資料' })
  })
})
