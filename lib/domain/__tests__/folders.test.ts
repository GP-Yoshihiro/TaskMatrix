import { describe, expect, it } from 'vitest'
import { buildFolderTree, validateFolderName } from '@/lib/domain/folders'

describe('buildFolderTree', () => {
  it('空配列から空のツリーを作る', () => {
    expect(buildFolderTree([])).toEqual([])
  })

  it('親子関係を組み立てる', () => {
    const tree = buildFolderTree([
      { id: 'a', name: '設計', parentId: null },
      { id: 'b', name: '詳細設計', parentId: 'a' },
      { id: 'c', name: '議事録', parentId: null },
    ])

    // ルートは 2 件。並び順は読み仮名による日本語照合（ぎじろく < せっけい）
    expect(tree).toHaveLength(2)
    expect(tree.map((node) => node.name)).toEqual(['議事録', '設計'])

    const design = tree.find((node) => node.name === '設計')!
    expect(design.children).toHaveLength(1)
    expect(design.children[0].name).toBe('詳細設計')

    const minutes = tree.find((node) => node.name === '議事録')!
    expect(minutes.children).toHaveLength(0)
  })

  it('3 階層を組み立てる', () => {
    const tree = buildFolderTree([
      { id: 'a', name: '1', parentId: null },
      { id: 'b', name: '2', parentId: 'a' },
      { id: 'c', name: '3', parentId: 'b' },
    ])
    expect(tree[0].children[0].children[0].name).toBe('3')
  })

  it('親が存在しない行はルート扱いにする', () => {
    const tree = buildFolderTree([{ id: 'b', name: '孤児', parentId: 'missing' }])
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('孤児')
  })

  it('同階層は名前順に並べる', () => {
    const tree = buildFolderTree([
      { id: 'b', name: 'い', parentId: null },
      { id: 'a', name: 'あ', parentId: null },
    ])
    expect(tree.map((n) => n.name)).toEqual(['あ', 'い'])
  })
})

describe('validateFolderName', () => {
  it('前後の空白を取り除いて受け入れる', () => {
    const result = validateFolderName('  設計  ')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe('設計')
  })

  it('空文字を拒否する', () => {
    expect(validateFolderName('   ').ok).toBe(false)
  })

  it('パス区切り文字を含む名前を拒否する', () => {
    expect(validateFolderName('設計/詳細').ok).toBe(false)
    expect(validateFolderName('設計\\詳細').ok).toBe(false)
  })

  it('100 文字を超える名前を拒否する', () => {
    expect(validateFolderName('あ'.repeat(101)).ok).toBe(false)
  })
})
