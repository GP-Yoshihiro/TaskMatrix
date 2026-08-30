import { describe, expect, it } from 'vitest'
import {
  MAX_PROJECTS_PER_USER,
  canCreateProject,
  validateProjectName,
} from '@/lib/domain/projects'

describe('canCreateProject', () => {
  it('上限未満なら作成できる', () => {
    expect(canCreateProject(0)).toBe(true)
    expect(canCreateProject(19)).toBe(true)
  })

  it('上限に達していたら作成できない', () => {
    expect(canCreateProject(MAX_PROJECTS_PER_USER)).toBe(false)
    expect(canCreateProject(21)).toBe(false)
  })

  it('上限は 20 件である', () => {
    expect(MAX_PROJECTS_PER_USER).toBe(20)
  })
})

describe('validateProjectName', () => {
  it('前後の空白を取り除いて受け入れる', () => {
    const result = validateProjectName('  新規プロジェクト  ')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe('新規プロジェクト')
  })

  it('空文字を拒否する', () => {
    const result = validateProjectName('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('100 文字を超える名前を拒否する', () => {
    const result = validateProjectName('あ'.repeat(101))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('ちょうど 100 文字は受け入れる', () => {
    const result = validateProjectName('あ'.repeat(100))
    expect(result.ok).toBe(true)
  })
})
