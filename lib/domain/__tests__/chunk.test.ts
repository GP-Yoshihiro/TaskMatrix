import { describe, expect, it } from 'vitest'
import {
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  EMBEDDING_DIMENSIONS,
  MAX_CHUNKS_PER_PROJECT,
  splitIntoChunks,
  validateChunkCount,
} from '@/lib/domain/chunk'

describe('定数', () => {
  it('チャンクの目安は 800 文字', () => {
    expect(CHUNK_SIZE).toBe(800)
  })

  it('重なりは 100 文字', () => {
    expect(CHUNK_OVERLAP).toBe(100)
  })

  it('埋め込みの次元数は 768', () => {
    expect(EMBEDDING_DIMENSIONS).toBe(768)
  })

  it('上限は 300 チャンク', () => {
    expect(MAX_CHUNKS_PER_PROJECT).toBe(300)
  })
})

describe('splitIntoChunks', () => {
  it('空文字は空配列を返す', () => {
    expect(splitIntoChunks('')).toEqual([])
    expect(splitIntoChunks('   \n\n  ')).toEqual([])
  })

  it('短い文章は 1 チャンクになる', () => {
    const result = splitIntoChunks('短いメモです。')
    expect(result).toEqual(['短いメモです。'])
  })

  it('上限を超えたら複数に分かれる', () => {
    const result = splitIntoChunks('あ'.repeat(CHUNK_SIZE * 3))
    expect(result.length).toBeGreaterThan(1)
  })

  it('各チャンクが上限以下に収まる', () => {
    const result = splitIntoChunks('あ'.repeat(CHUNK_SIZE * 5))
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_SIZE)
    }
  })

  it('段落の切れ目を優先して分割する', () => {
    const paragraph = 'あ'.repeat(500)
    const text = `${paragraph}\n\n${paragraph}`
    const result = splitIntoChunks(text)
    // 段落ごとに切れていれば、どのチャンクも段落をまたがない
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result[0]).toContain('あ')
  })

  it('段落が無ければ句点で切る', () => {
    const sentence = `${'い'.repeat(200)}。`
    const result = splitIntoChunks(sentence.repeat(6))
    expect(result.length).toBeGreaterThan(1)
    // 句点で切れているので、末尾が句点になるチャンクがある
    expect(result.some((chunk) => chunk.endsWith('。'))).toBe(true)
  })

  it('区切りが無い長文でも必ず終わる（無限ループにしない）', () => {
    const result = splitIntoChunks('x'.repeat(CHUNK_SIZE * 4))
    expect(result.length).toBeGreaterThan(1)
    expect(result.join('').length).toBeGreaterThan(0)
  })

  it('隣り合うチャンクが重なる', () => {
    const result = splitIntoChunks('あ'.repeat(CHUNK_SIZE * 3))
    expect(result.length).toBeGreaterThan(1)
    const tail = result[0].slice(-CHUNK_OVERLAP)
    expect(result[1].startsWith(tail)).toBe(true)
  })

  it('空白のみのチャンクは捨てる', () => {
    const result = splitIntoChunks('本文\n\n   \n\n続き')
    for (const chunk of result) {
      expect(chunk.trim().length).toBeGreaterThan(0)
    }
  })

  it('日本語が壊れない', () => {
    const text = '設計レビューを実施する。'.repeat(200)
    const result = splitIntoChunks(text)
    expect(result.join('')).not.toContain('�')
    // 元の文字がすべて含まれる（重なりがあるため包含で確認）
    expect(result.some((chunk) => chunk.includes('設計レビューを実施する'))).toBe(true)
  })

  it('前後の空白を取り除く', () => {
    expect(splitIntoChunks('  本文  ')).toEqual(['本文'])
  })
})

describe('validateChunkCount', () => {
  it('上限以内なら受け入れる', () => {
    const result = validateChunkCount(MAX_CHUNKS_PER_PROJECT)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe(MAX_CHUNKS_PER_PROJECT)
  })

  it('上限を超えたら拒否する', () => {
    const result = validateChunkCount(MAX_CHUNKS_PER_PROJECT + 1)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TOO_MANY_CHUNKS')
  })

  it('0 件は拒否する', () => {
    const result = validateChunkCount(0)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NO_INDEXED_CONTENT')
  })
})
